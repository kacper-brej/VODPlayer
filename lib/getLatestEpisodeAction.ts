"use server";
import { getSeriesResume } from "@/lib/continueWatching";

const getLatestEpisodeAction = async (
    seriesKey: string,
): Promise<{ fileID: string; time: number; duration: number | null } | null> => {
    const resume = await getSeriesResume(seriesKey);

    if (!resume) return null;

    return {
        fileID: resume.episodeKey,
        time: resume.positionSeconds,
        duration: resume.durationSeconds,
    };
};

export default getLatestEpisodeAction;
