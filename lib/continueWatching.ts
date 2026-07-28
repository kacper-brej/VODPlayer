import { cache } from "react";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateContinueProgressResponse,
    type ResumePoint,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

export type { ResumePoint };

const loadContinueWatching = async (): Promise<DataResult<ResumePoint[]>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `&profile_id=${encodeURIComponent(profileId)}` : "";
        const res = await fetch(`${VOD_ORIGIN}/progress.php?action=continue${profileParam}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("progress.php continue ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateContinueProgressResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return result.data.items.length === 0
            ? dataEmpty(result.data.items)
            : dataSuccess(result.data.items);
    } catch (error) {
        console.error("Continue watching request failed:", error);
        return dataFailure("network");
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
