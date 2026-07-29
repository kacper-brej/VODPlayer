import { cache } from "react";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import { validateRankingsResponse, type RankingItem } from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

export const RANKING_MIN_ITEMS = 3;

const loadWeeklyRanking = async (): Promise<DataResult<RankingItem[]>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const res = await fetch(`${VOD_ORIGIN}/rankings.php?period=week`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) return failureFromStatus(res.status);

        const payload: unknown = await res.json();
        const result = validateRankingsResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return result.data.items.length === 0
            ? dataEmpty(result.data.items)
            : dataSuccess(result.data.items);
    } catch (error) {
        console.error("Rankings request failed:", error);
        return dataFailure("network");
    }
};

export const getWeeklyRanking = cache(loadWeeklyRanking);
