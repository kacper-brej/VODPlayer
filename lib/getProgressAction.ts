"use server";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateSeriesProgressResponse,
    type SeriesProgressResponse,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

type SeriesProgress = Pick<SeriesProgressResponse, "episodes" | "resume">;

export const getSeriesProgressAction = async (
    seriesKey: string,
): Promise<DataResult<SeriesProgress>> => {
    const headers = await sessionHeaders();
    const empty: SeriesProgress = { episodes: {}, resume: null };

    if (!headers) return dataFailure("unauthorized");
    if (!seriesKey) return dataEmpty(empty);

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `&profile_id=${encodeURIComponent(profileId)}` : "";
        const res = await fetch(
            `${VOD_ORIGIN}/progress.php?action=series&series=${encodeURIComponent(seriesKey)}${profileParam}`,
            {
                headers,
                cache: "no-store",
            },
        );

        if (!res.ok) {
            console.error("progress.php series ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateSeriesProgressResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        const data = { episodes: result.data.episodes, resume: result.data.resume };
        return Object.keys(data.episodes).length === 0 && data.resume === null
            ? dataEmpty(data)
            : dataSuccess(data);
    } catch (error) {
        console.error("Series progress request failed:", error);
        return dataFailure("network");
    }
};

const getProgressAction = async (seriesKey: string, episodeKey: string): Promise<DataResult<number>> => {
    const result = await getSeriesProgressAction(seriesKey);
    if (result.kind === "error") return result;

    const progress = result.data.episodes[episodeKey];
    return progress
        ? dataSuccess(progress.positionSeconds)
        : dataEmpty(0);
};

export default getProgressAction;
