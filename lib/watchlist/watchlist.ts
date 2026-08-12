import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getWatchlist as getWatchlistFromDal } from "@/lib/watchlist/watchlistService";
import { type WatchlistItem } from "@/lib/core/contracts";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

export type { WatchlistItem };

const loadWatchlist = async (): Promise<DataResult<WatchlistItem[]>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    try {
        const items = await getWatchlistFromDal(user.id, user.username);
        return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
    } catch (error) {
        console.error("getWatchlist failed:", error);
        return dataFailure("server");
    }
};

export const getWatchlist = cache(loadWatchlist);

export const isInWatchlist = async (seriesKey: string): Promise<boolean> => {
    const result = await getWatchlist();
    if (result.kind === "error") return false;

    return result.data.some((item) => item.seriesKey === seriesKey);
};
