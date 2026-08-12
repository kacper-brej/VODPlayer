import { NextResponse } from "next/server";
import { readJsonBodyWithLimit } from "@/lib/http/requestBody";
import { requireAdminRoute, requireSessionRoute } from "@/lib/http/routeAuth";
import { getEpisodeChapters, saveChapter, deleteChapter } from "@/lib/chapters/chapterService";
import type { EpisodeChapterType } from "@/lib/core/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isChapterType = (value: string | null): value is EpisodeChapterType =>
    value === "intro" || value === "outro" || value === "recap";

export const GET = async (request: Request) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(request.url);
    const series = searchParams.get("series");
    const episode = searchParams.get("episode");
    if (!series || !episode) {
        return NextResponse.json({ error: "Brak identyfikatora serialu lub odcinka." }, { status: 422 });
    }

    const chapters = await getEpisodeChapters(series, episode);
    return NextResponse.json(chapters);
};

export const POST = async (request: Request) => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 422 });
    }

    const { series, episode, type, startSeconds, endSeconds, applyToSeries } = payload as Record<string, unknown>;
    if (typeof series !== "string" || typeof episode !== "string" || typeof applyToSeries !== "boolean") {
        return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 422 });
    }

    const result = await saveChapter(series, episode, type, startSeconds, endSeconds, applyToSeries);
    if (!result.ok) {
        const status = result.code === "server" ? 500 : 422;
        const message = result.code === "overlap"
            ? "Zakres rozdziału nakłada się z innym rozdziałem tego odcinka."
            : result.code === "server"
                ? "Nie udało się zapisać rozdziałów."
                : "Nieprawidłowe dane rozdziału.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true, affectedEpisodes: result.affectedEpisodes, chapter: result.chapter });
};

export const DELETE = async (request: Request) => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(request.url);
    const series = searchParams.get("series");
    const episode = searchParams.get("episode");
    const type = searchParams.get("type");
    if (!series || !episode || !isChapterType(type)) {
        return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 422 });
    }

    const result = await deleteChapter(series, episode, type);
    if (!result.ok) {
        return NextResponse.json({ error: "Nie udało się usunąć rozdziału." }, { status: result.code === "server" ? 500 : 422 });
    }

    return NextResponse.json({ success: true, deleted: result.deleted });
};
