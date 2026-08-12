import "server-only";
import { getCatalog } from "@/lib/catalog/catalog";
import type { RankingItem } from "@/lib/core/contracts";
import { listCurrentWeekPlayCounts } from "@/lib/rankings/rankingRepository";

const RANKING_LIMIT = 10;

export const getWeeklyRanking = async (): Promise<RankingItem[]> => {
    const [playCounts, catalogResult] = await Promise.all([
        listCurrentWeekPlayCounts(),
        getCatalog(),
    ]);

    if (playCounts.length === 0) return [];

    const existingKeys = catalogResult.kind === "error"
        ? null
        : new Set(catalogResult.data.map((series) => series.key));

    const items: RankingItem[] = [];
    for (const entry of playCounts) {
        if (items.length >= RANKING_LIMIT) break;
        if (existingKeys !== null && !existingKeys.has(entry.seriesKey)) continue;

        items.push({ seriesKey: entry.seriesKey, playCount: entry.playCount, rank: items.length + 1 });
    }

    return items;
};
