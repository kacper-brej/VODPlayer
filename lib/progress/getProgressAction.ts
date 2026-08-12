import { getSessionUser } from "@/lib/auth/session";
import { getProgressSnapshot, getSeriesProgress, type ProgressReadModel } from "@/lib/progress/progressService";
import type { EpisodeProgress, SeriesResumePoint } from "@/lib/core/contracts";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

type SeriesProgress = { episodes: Record<string, EpisodeProgress>; resume: SeriesResumePoint | null };

export const getProgressSnapshotAction = async (seriesKeys: readonly string[]): Promise<DataResult<ProgressReadModel>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    const uniqueKeys = [...new Set(seriesKeys.map((key) => key.trim()))];
    if (uniqueKeys.length > 250 || uniqueKeys.some((key) => !key || key.length > 255)) return dataFailure("invalid_response", 422);
    try {
        const snapshot = await getProgressSnapshot(user.id, user.username, uniqueKeys);
        return snapshot.resumes.length === 0 && Object.keys(snapshot.episodesBySeries).length === 0
            ? dataEmpty(snapshot)
            : dataSuccess(snapshot);
    } catch (error) {
        console.error("getProgressSnapshot failed:", error);
        return dataFailure("server");
    }
};

export const getSeriesProgressAction = async (seriesKey: string): Promise<DataResult<SeriesProgress>> => {
    const user = await getSessionUser();
    const empty: SeriesProgress = { episodes: {}, resume: null };

    if (!user) return dataFailure("unauthorized");
    if (!seriesKey) return dataEmpty(empty);

    try {
        const progress = await getSeriesProgress(user.id, user.username, seriesKey);
        if (!progress) return dataEmpty(empty);

        const data = { episodes: progress.episodes, resume: progress.resume };
        return Object.keys(data.episodes).length === 0 && data.resume === null ? dataEmpty(data) : dataSuccess(data);
    } catch (error) {
        console.error("getSeriesProgress failed:", error);
        return dataFailure("server");
    }
};

const getProgressAction = async (seriesKey: string, episodeKey: string): Promise<DataResult<number>> => {
    const result = await getSeriesProgressAction(seriesKey);
    if (result.kind === "error") return result;

    const progress = result.data.episodes[episodeKey];
    return progress ? dataSuccess(progress.positionSeconds) : dataEmpty(0);
};

export default getProgressAction;
