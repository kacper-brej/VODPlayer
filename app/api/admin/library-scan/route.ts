import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import {
    libraryOverview,
    registerFileEpisodes,
    type LibraryScanFailure,
} from "@/lib/media/libraryRegistrationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FAILURE_MESSAGE: Record<LibraryScanFailure, string> = {
    unconfigured: "Skan wymaga zmiennej MEDIA_FILE_ORIGIN.",
    unreachable: "Serwer z plikami nie odpowiedział.",
    rejected: "Serwer z plikami odrzucił żądanie — sprawdź, czy VIDEO_SIGNING_SECRET jest ten sam po obu stronach.",
    malformed: "Serwer z plikami zwrócił nieczytelną odpowiedź.",
};

const failure = (code: LibraryScanFailure) =>
    NextResponse.json(
        { error: FAILURE_MESSAGE[code] },
        { status: code === "unconfigured" ? 503 : 502, headers: { "Cache-Control": "no-store" } },
    );

export const GET = async () => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    try {
        const result = await libraryOverview();
        if (!result.ok) return failure(result.code);
        return NextResponse.json(
            { entries: result.entries, counts: result.counts },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("GET /api/admin/library-scan failed", error);
        return NextResponse.json({ error: "Nie udało się odczytać zawartości serwera." }, { status: 500 });
    }
};

const isRequestList = (value: unknown): value is Array<{ seriesKey: string; episodeKey: string }> =>
    Array.isArray(value)
    && value.length <= 500
    && value.every((item) =>
        typeof item === "object" && item !== null
        && typeof (item as { seriesKey?: unknown }).seriesKey === "string"
        && typeof (item as { episodeKey?: unknown }).episodeKey === "string");

export const POST = async (request: Request) => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    const payload = await request.json().catch(() => null) as { episodes?: unknown } | null;
    if (!isRequestList(payload?.episodes)) {
        return NextResponse.json({ error: "Nieprawidłowa lista odcinków." }, { status: 422 });
    }

    try {
        const result = await registerFileEpisodes(payload.episodes);
        if (!result.ok) return failure(result.code);
        return NextResponse.json(result.summary, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("POST /api/admin/library-scan failed", error);
        return NextResponse.json({ error: "Nie udało się zarejestrować odcinków." }, { status: 500 });
    }
};
