import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import { getNewestSeries } from "@/lib/catalog/catalogRows";
import { mapTmdbListToCatalog } from "@/lib/catalog/tmdbCatalogMapping";
import type { TmdbTvListItem } from "@/lib/core/contracts";
import { dataFailure, type DataResult } from "@/lib/core/dataResult";
import { HOME_SECTION_PRESENTATION } from "@/lib/home/homeLayout";
import type {
    HomeRow,
    HomeRowId,
    HomeRowResult,
    HomeRowSource,
    HomeRowVariant,
} from "@/lib/home/homeRowTypes";
import {
    getTmdbOnTheAirTv,
    getTmdbPopularTv,
    getTmdbTopRatedTv,
    getTmdbTrendingTv,
} from "@/lib/metadata/tmdbLists";
import { getTmdbImageBaseUrl } from "@/lib/metadata/tmdbConfig";
import { virtualSeriesFromListItem } from "@/lib/catalog/tmdbVirtualSeries";

const TMDB_ROW_MIN_ITEMS = 3;

interface TmdbHomeRowSpec {
    id: HomeRowId;
    title: string;
    kicker: string;
    source: HomeRowSource;
    variant: HomeRowVariant;
    limit: number;
}

const TMDB_ROW_SPECS = {
    trendingToday: {
        id: "trending-today",
        ...HOME_SECTION_PRESENTATION["trending-today"],
        kicker: "TMDB / DZIŚ",
        source: "tmdb-trending-day",
        limit: 10,
    },
    popularNow: {
        id: "popular-now",
        ...HOME_SECTION_PRESENTATION["popular-now"],
        kicker: "TMDB / POPULARNE",
        source: "tmdb-popular",
        limit: 20,
    },
    topRated: {
        id: "top-rated",
        ...HOME_SECTION_PRESENTATION["top-rated"],
        kicker: "TMDB / OCENY",
        source: "tmdb-top-rated",
        limit: 20,
    },
    onTheAir: {
        id: "on-the-air",
        ...HOME_SECTION_PRESENTATION["on-the-air"],
        kicker: "TMDB / EMISJA",
        source: "tmdb-on-the-air",
        limit: 20,
    },
} as const satisfies Record<string, TmdbHomeRowSpec>;

type TmdbListLoader = () => Promise<DataResult<TmdbTvListItem[]>>;

export interface PublicHomeRowSources {
    trendingToday: TmdbListLoader;
    popularNow: TmdbListLoader;
    topRated: TmdbListLoader;
    onTheAir: TmdbListLoader;
}

const defaultSources: PublicHomeRowSources = {
    trendingToday: () => getTmdbTrendingTv("day"),
    popularNow: getTmdbPopularTv,
    topRated: getTmdbTopRatedTv,
    onTheAir: getTmdbOnTheAirTv,
};

const loadSafely = async (loader: TmdbListLoader): Promise<DataResult<TmdbTvListItem[]>> => {
    try {
        return await loader();
    } catch {
        return dataFailure("server");
    }
};

const resolveImageBaseUrl = async (): Promise<string | null> => {
    try {
        const result = await getTmdbImageBaseUrl();
        return result.kind === "error" ? null : result.data;
    } catch {
        return null;
    }
};

export const buildTmdbHomeRow = (
    spec: TmdbHomeRowSpec,
    result: DataResult<TmdbTvListItem[]>,
    catalog: readonly CatalogSeries[],
    imageBaseUrl: string | null = null,
): HomeRowResult => {
    if (result.kind === "error") {
        return {
            kind: "error",
            id: spec.id,
            source: spec.source,
            reason: result.reason,
            ...(result.status === undefined ? {} : { status: result.status }),
        };
    }

    const mapped = mapTmdbListToCatalog(result.data, catalog, spec.limit, {
        createFallback: (item) => virtualSeriesFromListItem(item, imageBaseUrl),
    });
    if (mapped.series.length < TMDB_ROW_MIN_ITEMS) {
        return {
            kind: "omitted",
            id: spec.id,
            source: spec.source,
            reason: "insufficient_matches",
            diagnostics: mapped.stats,
        };
    }

    return {
        kind: "ready",
        row: {
            id: spec.id,
            title: spec.title,
            kicker: spec.kicker,
            source: spec.source,
            variant: spec.variant,
            items: mapped.series,
        },
        diagnostics: mapped.stats,
    };
};

export const buildNewestHomeRow = (catalog: readonly CatalogSeries[]): HomeRowResult => {
    const items = getNewestSeries([...catalog], 20);
    if (items.length === 0) {
        return {
            kind: "omitted",
            id: "newest-local",
            source: "local-newest",
            reason: "insufficient_matches",
        };
    }

    const row: HomeRow = {
        id: "newest-local",
        ...HOME_SECTION_PRESENTATION["newest-local"],
        kicker: "NOCTURNA / NOWOŚCI",
        source: "local-newest",
        items,
    };

    return { kind: "ready", row };
};

export const getPublicHomeRows = async (
    catalog: readonly CatalogSeries[],
    sources: PublicHomeRowSources = defaultSources,
): Promise<HomeRowResult[]> => {
    const [trendingToday, popularNow, topRated, onTheAir, imageBaseUrl] = await Promise.all([
        loadSafely(sources.trendingToday),
        loadSafely(sources.popularNow),
        loadSafely(sources.topRated),
        loadSafely(sources.onTheAir),
        resolveImageBaseUrl(),
    ]);

    return [
        buildTmdbHomeRow(TMDB_ROW_SPECS.trendingToday, trendingToday, catalog, imageBaseUrl),
        buildNewestHomeRow(catalog),
        buildTmdbHomeRow(TMDB_ROW_SPECS.popularNow, popularNow, catalog, imageBaseUrl),
        buildTmdbHomeRow(TMDB_ROW_SPECS.topRated, topRated, catalog, imageBaseUrl),
        buildTmdbHomeRow(TMDB_ROW_SPECS.onTheAir, onTheAir, catalog, imageBaseUrl),
    ];
};
