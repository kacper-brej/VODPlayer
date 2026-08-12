import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getWeeklyRanking as getWeeklyRankingFromService } from "@/lib/rankings/rankingService";
import type { RankingItem } from "@/lib/core/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";

export const RANKING_MIN_ITEMS = 3;

const loadWeeklyRanking = async (): Promise<DataResult<RankingItem[]>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);

    try {
        const items = await getWeeklyRankingFromService();
        return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
    } catch (error) {
        console.error("getWeeklyRanking failed:", error);
        return dataFailure("server");
    }
};

export const getWeeklyRanking = cache(loadWeeklyRanking);
