import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import { getNewestSeries } from "@/lib/catalog/catalogRows";
import { mapTmdbListToCatalog } from "@/lib/catalog/tmdbCatalogMapping";
import type { TmdbTvListItem } from "@/lib/core/contracts";
import { dataFailure, type DataResult } from "@/lib/core/dataResult";
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
        title: "Top 10 trendów dzisiaj",
        kicker: "TMDB / DZIŚ",
        source: "tmdb-trending-day",
        variant: "ranking",
        limit: 10,
    },
    popularNow: {
        id: "popular-now",
        title: "Popularne teraz",
        kicker: "TMDB / POPULARNE",
        source: "tmdb-popular",
        variant: "classic",
        limit: 20,
    },
    topRated: {
        id: "top-rated",
        title: "Najwyżej oceniane",
        kicker: "TMDB / OCENY",
        source: "tmdb-top-rated",
        variant: "classic",
        limit: 20,
    },
    onTheAir: {
        id: "on-the-air",
        title: "Nowe odcinki w tym tygodniu",
        kicker: "TMDB / EMISJA",
        source: "tmdb-on-the-air",
        variant: "classic",
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

export const buildTmdbHomeRow = (
    spec: TmdbHomeRowSpec,
    result: DataResult<TmdbTvListItem[]>,
    catalog: readonly CatalogSeries[],
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

    const mapped = mapTmdbListToCatalog(result.data, catalog, spec.limit);
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
        title: "Najnowsze w Nocturna",
        kicker: "NOCTURNA / NOWOŚCI",
        source: "local-newest",
        variant: "classic",
        items,
    };

    return { kind: "ready", row };
};

export const getPublicHomeRows = async (
    catalog: readonly CatalogSeries[],
    sources: PublicHomeRowSources = defaultSources,
): Promise<HomeRowResult[]> => {
    const [trendingToday, popularNow, topRated, onTheAir] = await Promise.all([
        loadSafely(sources.trendingToday),
        loadSafely(sources.popularNow),
        loadSafely(sources.topRated),
        loadSafely(sources.onTheAir),
    ]);

    return [
        buildTmdbHomeRow(TMDB_ROW_SPECS.trendingToday, trendingToday, catalog),
        buildNewestHomeRow(catalog),
        buildTmdbHomeRow(TMDB_ROW_SPECS.popularNow, popularNow, catalog),
        buildTmdbHomeRow(TMDB_ROW_SPECS.topRated, topRated, catalog),
        buildTmdbHomeRow(TMDB_ROW_SPECS.onTheAir, onTheAir, catalog),
    ];
};
