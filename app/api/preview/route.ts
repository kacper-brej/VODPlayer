import { getSessionUser } from "@/lib/auth/session";
import { createPreviewSession } from "@/lib/player/previewService";
import { canStreamSeries } from "@/lib/access/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (status: number, message: string) =>
    Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

const validSeriesKey = (value: string): boolean =>
    value.length > 0 && value.length <= 255 && !value.startsWith(".") && !/[\x00-\x1f\x7f/\\]/u.test(value);
const validEpisodeKey = (value: string): boolean =>
    value.length <= 255 && /^[^./\\]+\.mp4$/iu.test(value);

export const GET = async (request: Request) => {
    const user = await getSessionUser();
    if (!user) return fail(401, "Brak autoryzacji.");

    const { searchParams } = new URL(request.url);
    const seriesKey = searchParams.get("s") ?? "";
    const episodeKey = searchParams.get("e") ?? "";
    if (!validSeriesKey(seriesKey) || !validEpisodeKey(episodeKey)) {
        return fail(400, "Nieprawidlowy identyfikator materialu.");
    }

    try {
        if (!await canStreamSeries(user, seriesKey)) return fail(403, "Brak dostępu do materiału.");
    } catch {
        return fail(500, "Błąd serwera.");
    }

    const result = await createPreviewSession(
        user.id,
        user.username,
        seriesKey,
        episodeKey,
        searchParams.get("reduceData") === "1",
    );
    if (!result.ok) {
        if (result.code === "not_found") return fail(404, "Podglad niedostepny.");
        if (result.code === "storage") return fail(502, "Nie udalo sie przygotowac podgladu.");
        return fail(500, "Blad serwera.");
    }

    return Response.json(result.source, {
        status: 200,
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
};
