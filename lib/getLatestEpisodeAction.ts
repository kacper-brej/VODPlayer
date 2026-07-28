"use server";
import { getSeriesResume } from "@/lib/continueWatching";
import { dataEmpty, dataSuccess, type DataResult } from "@/lib/dataResult";

type LatestEpisode = { fileID: string; time: number; duration: number | null };

const getLatestEpisodeAction = async (
    seriesKey: string,
): Promise<DataResult<LatestEpisode | null>> => {
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
