import { cache } from "react";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateWatchlistResponse,
    type WatchlistItem,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

export type { WatchlistItem };

const loadWatchlist = async (): Promise<DataResult<WatchlistItem[]>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
        const res = await fetch(`${VOD_ORIGIN}/watchlist.php${profileParam}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("watchlist.php GET ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateWatchlistResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return result.data.items.length === 0
            ? dataEmpty(result.data.items)
            : dataSuccess(result.data.items);
    } catch (error) {
        console.error("Watchlist request failed:", error);
        return dataFailure("network");
    }
};

export const getWatchlist = cache(loadWatchlist);

export const isInWatchlist = async (seriesKey: string): Promise<boolean> => {
    const result = await getWatchlist();
    if (result.kind === "error") return false;

    return result.data.some((item) => item.seriesKey === seriesKey);
};
