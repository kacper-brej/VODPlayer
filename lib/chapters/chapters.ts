import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getEpisodeChapters as getEpisodeChaptersFromService } from "@/lib/chapters/chapterService";
import type { EpisodeChapter } from "@/lib/core/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";

const DEFAULT_INTRO: EpisodeChapter = {
    startSeconds: 0,
    endSeconds: 90,
    type: "intro",
};

const withDefaultIntro = (chapters: EpisodeChapter[]) =>
    chapters.some((chapter) => chapter.type === "intro")
        ? chapters
        : [...chapters, DEFAULT_INTRO].sort((a, b) => a.startSeconds - b.startSeconds);

export const getEpisodeChapters = cache(async (
    seriesKey: string,
    episodeKey: string,
): Promise<DataResult<EpisodeChapter[]>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");
    if (!seriesKey || !episodeKey) return dataEmpty([]);

    try {
        const chapters = withDefaultIntro(await getEpisodeChaptersFromService(seriesKey, episodeKey));
        return chapters.length === 0 ? dataEmpty(chapters) : dataSuccess(chapters);
    } catch (error) {
        console.error("getEpisodeChapters failed:", error);
        return dataFailure("server");
    }
});
