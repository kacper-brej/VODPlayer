import "server-only";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import {
    validateEpisodeChaptersResponse,
    type EpisodeChapter,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

const DEFAULT_INTRO: EpisodeChapter = {
    startSeconds: 0,
    endSeconds: 90,
    type: "intro",
};

const withDefaultIntro = (chapters: EpisodeChapter[]) =>
    chapters.some((chapter) => chapter.type === "intro")
        ? chapters
        : [...chapters, DEFAULT_INTRO].sort((a, b) => a.startSeconds - b.startSeconds);

export const getEpisodeChapters = async (
    seriesKey: string,
    episodeKey: string,
): Promise<DataResult<EpisodeChapter[]>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");
    if (!seriesKey || !episodeKey) return dataEmpty([]);

    try {
        const params = new URLSearchParams({
            series: seriesKey,
            episode: episodeKey,
        });
        const response = await fetch(`${VOD_ORIGIN}/chapters.php?${params}`, {
            headers,
            cache: "no-store",
        });

        if (!response.ok) {
            console.error("chapters.php GET ->", response.status, await response.text());
            return failureFromStatus(response.status);
        }

        const payload: unknown = await response.json();
        const result = validateEpisodeChaptersResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        const chapters = withDefaultIntro(result.data);

        return dataSuccess(chapters);
    } catch (error) {
        console.error("Episode chapters request failed:", error);
        return dataFailure("network");
    }
};
