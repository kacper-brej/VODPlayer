"use server";
import { getSeriesResume } from "@/lib/progress/continueWatching";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { getSessionUser } from "@/lib/auth/session";

type LatestEpisode = { fileID: string; time: number; duration: number | null };

const getLatestEpisodeAction = async (
    seriesKey: string,
): Promise<DataResult<LatestEpisode | null>> => {
    if (!await getSessionUser()) return dataFailure("unauthorized", 401);
    if (!seriesKey || seriesKey.length > 191) return dataEmpty(null);
    const result = await getSeriesResume(seriesKey);
    if (result.kind === "error") return result;

    if (!result.data) return dataEmpty(null);

    return dataSuccess({
        fileID: result.data.episodeKey,
        time: result.data.positionSeconds,
        duration: result.data.durationSeconds,
    });
};

export default getLatestEpisodeAction;
