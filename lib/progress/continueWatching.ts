import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getContinueWatching as getContinueWatchingFromDal } from "@/lib/progress/progressService";
import { type ResumePoint } from "@/lib/core/contracts";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

export type { ResumePoint };

const loadContinueWatching = async (): Promise<DataResult<ResumePoint[]>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    try {
        const items = await getContinueWatchingFromDal(user.id, user.username);
        return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
    } catch (error) {
        console.error("getContinueWatching failed:", error);
        return dataFailure("server");
    }
};

export const getContinueWatching = cache(loadContinueWatching);

export const getResumeMap = cache(async (): Promise<DataResult<Map<string, ResumePoint>>> => {
    const result = await getContinueWatching();
    if (result.kind === "error") return result;

    const items = new Map(result.data.map((item) => [item.seriesKey, item]));
    return items.size === 0 ? dataEmpty(items) : dataSuccess(items);
});

export const getLatestResume = cache(async (): Promise<DataResult<ResumePoint | null>> => {
    const result = await getContinueWatching();
    if (result.kind === "error") return result;

    const resume = result.data[0] ?? null;
    return resume ? dataSuccess(resume) : dataEmpty(null);
});

export const getSeriesResume = cache(async (seriesKey: string): Promise<DataResult<ResumePoint | null>> => {
    const result = await getResumeMap();
    if (result.kind === "error") return result;

    const resume = result.data.get(seriesKey) ?? null;
    return resume ? dataSuccess(resume) : dataEmpty(null);
});
