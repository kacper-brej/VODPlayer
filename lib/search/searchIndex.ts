import { cache } from "react";
import { getCatalog } from "@/lib/catalog/catalog";
import { dataEmpty, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { getResumeMap } from "@/lib/progress/continueWatching";
import { getWatchlist } from "@/lib/watchlist/watchlist";
import { collapseSeriesGroups } from "@/lib/catalog/catalogRows";
import { prepareSearchEntries, type PreparedSearchEntry, type SearchRecord } from "@/lib/search";

export interface SearchIndexRecord extends SearchRecord {
    year: number | null;
    episodeCount: number;
}

export type SearchIndexEntry = PreparedSearchEntry<SearchIndexRecord>;

const buildSearchIndex = async (): Promise<DataResult<SearchIndexEntry[]>> => {
    const [result, resumeResult, watchlistResult] = await Promise.all([
        getCatalog(),
        getResumeMap(),
        getWatchlist(),
    ]);
    if (result.kind === "error") return result;

    const resumeMap = resumeResult.kind === "error" ? new Map() : resumeResult.data;
    const watchlistKeys = new Set(
        watchlistResult.kind === "error" ? [] : watchlistResult.data.map((item) => item.seriesKey),
    );

    const entries = prepareSearchEntries(
        collapseSeriesGroups(result.data).map((series) => ({
            key: series.key,
            title: series.baseTitle ?? series.title,
            altTitles: [series.title, ...series.altTitles],
            year: series.year,
            episodeCount: series.episodeCount,
            inWatchlist: watchlistKeys.has(series.key),
            hasProgress: resumeMap.has(series.key),
        })),
    );

    return entries.length === 0 ? dataEmpty(entries) : dataSuccess(entries);
};

export const getSearchIndex = cache(buildSearchIndex);
