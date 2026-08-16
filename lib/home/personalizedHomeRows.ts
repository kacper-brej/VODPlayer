import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import {
    catalogSeriesIdentity,
    getCatalogRepresentatives,
    mapTmdbListToCatalog,
} from "@/lib/catalog/tmdbCatalogMapping";
import type { ResumePoint, TmdbTvListItem, WatchlistItem } from "@/lib/core/contracts";
import { type DataResult } from "@/lib/core/dataResult";
import type { HomeRowDiagnostics, HomeRowResult } from "@/lib/home/homeRowTypes";
import { getTmdbRecommendations } from "@/lib/metadata/tmdbLists";
import { getViewerProgressSnapshot } from "@/lib/progress/continueWatching";
import type { ProgressReadModel } from "@/lib/progress/progressService";
import { getWatchlist } from "@/lib/watchlist/watchlist";

const RECOMMENDATION_LIMIT = 20;
const RECOMMENDATION_MIN_ITEMS = 3;

export interface RecommendationSeed {
    series: CatalogSeries;
    tmdbId: number;
}

export interface PersonalizedHomeRowSources {
    watchlist: () => Promise<DataResult<WatchlistItem[]>>;
    progress: () => Promise<DataResult<ProgressReadModel>>;
    recommendations: (tmdbId: number) => Promise<DataResult<TmdbTvListItem[]>>;
}

const defaultSources: PersonalizedHomeRowSources = {
    watchlist: getWatchlist,
    progress: getViewerProgressSnapshot,
    recommendations: getTmdbRecommendations,
};

const errorResult = (
    id: "watchlist" | "recommendations",
    source: "local-watchlist" | "tmdb-recommendations",
    failure: Extract<DataResult<unknown>, { kind: "error" }>,
): HomeRowResult => ({
    kind: "error",
    id,
    source,
    reason: failure.reason,
    ...(failure.status === undefined ? {} : { status: failure.status }),
});

export const buildWatchlistHomeRow = (
    catalog: readonly CatalogSeries[],
    result: DataResult<WatchlistItem[]>,
): HomeRowResult => {
    if (result.kind === "error") {
        return errorResult("watchlist", "local-watchlist", result);
    }

    const byKey = new Map(catalog.map((series) => [series.key, series]));
    const representatives = getCatalogRepresentatives(catalog);
    const seen = new Set<string>();
    const items: CatalogSeries[] = [];

    for (const watchlistItem of result.data) {
        const series = byKey.get(watchlistItem.seriesKey);
        if (!series) continue;

        const identity = catalogSeriesIdentity(series);
        if (seen.has(identity)) continue;

        const representative = representatives.get(identity);
        if (!representative) continue;

        seen.add(identity);
        items.push(representative);
    }

    if (items.length === 0) {
        return {
            kind: "omitted",
            id: "watchlist",
            source: "local-watchlist",
            reason: "empty_watchlist",
        };
    }

    return {
        kind: "ready",
        row: {
            id: "watchlist",
            title: "Moja lista",
            kicker: "TWOJA LISTA",
            source: "local-watchlist",
            variant: "classic",
            items,
        },
    };
};

export const selectRecommendationSeed = (
    resumes: readonly ResumePoint[],
    catalog: readonly CatalogSeries[],
): RecommendationSeed | null => {
    const byKey = new Map(catalog.map((series) => [series.key, series]));
    const representatives = getCatalogRepresentatives(catalog);
    const newestFirst = [...resumes].sort((left, right) => right.updatedAt - left.updatedAt);

    for (const resume of newestFirst) {
        const series = byKey.get(resume.seriesKey);
        if (!series || series.tmdbExternalId === null) continue;

        return {
            series: representatives.get(catalogSeriesIdentity(series)) ?? series,
            tmdbId: series.tmdbExternalId,
        };
    }

    return null;
};

const isCompletedSeries = (
    series: CatalogSeries,
    catalog: readonly CatalogSeries[],
    progress: ProgressReadModel,
): boolean => {
    const identity = catalogSeriesIdentity(series);
    const members = catalog.filter((candidate) => catalogSeriesIdentity(candidate) === identity);
    const episodes = members.flatMap((member) =>
        member.episodes.map((episode) => ({ seriesKey: member.key, episodeKey: episode.key }))
    );

    return episodes.length > 0 && episodes.every(({ seriesKey, episodeKey }) =>
        progress.episodesBySeries[seriesKey]?.[episodeKey]?.completed === true
    );
};

export const buildRecommendationHomeRow = (
    catalog: readonly CatalogSeries[],
    progress: ProgressReadModel,
    seed: RecommendationSeed,
    result: DataResult<TmdbTvListItem[]>,
): HomeRowResult => {
    if (result.kind === "error") {
        return {
            kind: "omitted",
            id: "recommendations",
            source: "tmdb-recommendations",
            reason: "provider_unavailable",
        };
    }

    const mapped = mapTmdbListToCatalog(result.data, catalog, result.data.length);
    const seedIdentity = catalogSeriesIdentity(seed.series);
    const items = mapped.series
        .filter((series) => catalogSeriesIdentity(series) !== seedIdentity)
        .filter((series) => !isCompletedSeries(series, catalog, progress))
        .slice(0, RECOMMENDATION_LIMIT);
    const filteredCount = mapped.series.length - items.length;
    const diagnostics: HomeRowDiagnostics = {
        ...mapped.stats,
        matchedCount: items.length,
        rejectedCount: mapped.stats.rejectedCount + filteredCount,
    };

    if (items.length < RECOMMENDATION_MIN_ITEMS) {
        return {
            kind: "omitted",
            id: "recommendations",
            source: "tmdb-recommendations",
            reason: "insufficient_matches",
            diagnostics,
        };
    }

    return {
        kind: "ready",
        row: {
            id: "recommendations",
            title: `Ponieważ oglądałeś: ${seed.series.baseTitle ?? seed.series.title}`,
            kicker: "TMDB / DLA CIEBIE",
            source: "tmdb-recommendations",
            variant: "classic",
            items,
        },
        diagnostics,
    };
};

export const getPersonalizedHomeRows = async (
    catalog: readonly CatalogSeries[],
    sources: PersonalizedHomeRowSources = defaultSources,
): Promise<HomeRowResult[]> => {
    const [watchlistResult, progressResult] = await Promise.all([
        sources.watchlist().catch(() => ({ kind: "error" as const, reason: "server" as const })),
        sources.progress().catch(() => ({ kind: "error" as const, reason: "server" as const })),
    ]);
    const watchlistRow = buildWatchlistHomeRow(catalog, watchlistResult);

    if (progressResult.kind === "error") {
        return [
            watchlistRow,
            errorResult("recommendations", "tmdb-recommendations", progressResult),
        ];
    }

    const seed = selectRecommendationSeed(progressResult.data.resumes, catalog);
    if (!seed) {
        return [
            watchlistRow,
            {
                kind: "omitted",
                id: "recommendations",
                source: "tmdb-recommendations",
                reason: "no_seed",
            },
        ];
    }

    const recommendations = await sources.recommendations(seed.tmdbId)
        .catch(() => ({ kind: "error" as const, reason: "network" as const }));

    return [
        watchlistRow,
        buildRecommendationHomeRow(catalog, progressResult.data, seed, recommendations),
    ];
};
