import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import { mapTmdbListToCatalog } from "@/lib/catalog/tmdbCatalogMapping";
import {
    isVirtualTmdbKey,
    virtualSeriesFromListItem,
    virtualSeriesFromMovieListItem,
} from "@/lib/catalog/tmdbVirtualSeries";
import type { TmdbMovieListItem, TmdbTvListItem } from "@/lib/core/contracts";
import type { DataResult } from "@/lib/core/dataResult";
import { getTmdbImageBaseUrl } from "@/lib/metadata/tmdbConfig";
import { genreNamesFromIds, getTmdbGenreMap, type TmdbGenreMap } from "@/lib/metadata/tmdbGenres";
import {
    getTmdbPopularMovies,
    getTmdbPopularTv,
    getTmdbTopRatedMovies,
    getTmdbTopRatedTv,
    searchTmdbMovieList,
    searchTmdbTvList,
} from "@/lib/metadata/tmdbLists";

export const TMDB_CATALOG_LIMIT = 120;
export const TMDB_CATALOG_MIN_QUERY_LENGTH = 2;

export interface TmdbCatalogFeedOptions {
    query?: string;
    limit?: number;
}

export interface TmdbCatalogFeedSources {
    tvLists: () => Promise<TmdbTvListItem[]>;
    movieLists: () => Promise<TmdbMovieListItem[]>;
    tvSearch: (query: string) => Promise<TmdbTvListItem[]>;
    movieSearch: (query: string) => Promise<TmdbMovieListItem[]>;
    imageBaseUrl: () => Promise<string | null>;
    genres: (kind: "tv" | "movie") => Promise<TmdbGenreMap>;
}

const safely = async <TItem>(
    loader: () => Promise<DataResult<TItem[]>>,
): Promise<TItem[]> => {
    try {
        const result = await loader();
        return result.kind === "error" ? [] : result.data;
    } catch {
        return [];
    }
};

const defaultSources: TmdbCatalogFeedSources = {
    tvLists: async () => {
        const [popularFirst, popularSecond, topRated] = await Promise.all([
            safely(() => getTmdbPopularTv(1)),
            safely(() => getTmdbPopularTv(2)),
            safely(() => getTmdbTopRatedTv(1)),
        ]);

        return [...popularFirst, ...popularSecond, ...topRated];
    },
    movieLists: async () => {
        const [popularFirst, popularSecond, topRated] = await Promise.all([
            safely(() => getTmdbPopularMovies(1)),
            safely(() => getTmdbPopularMovies(2)),
            safely(() => getTmdbTopRatedMovies(1)),
        ]);

        return [...popularFirst, ...popularSecond, ...topRated];
    },
    tvSearch: (query) => safely(() => searchTmdbTvList(query)),
    movieSearch: (query) => safely(() => searchTmdbMovieList(query)),
    imageBaseUrl: async () => {
        try {
            const result = await getTmdbImageBaseUrl();
            return result.kind === "error" ? null : result.data;
        } catch {
            return null;
        }
    },
    genres: async (kind) => {
        try {
            return await getTmdbGenreMap(kind);
        } catch {
            return new Map();
        }
    },
};

const dedupeMovies = (items: readonly TmdbMovieListItem[]): TmdbMovieListItem[] => {
    const seen = new Set<number>();
    const unique: TmdbMovieListItem[] = [];

    for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        unique.push(item);
    }

    return unique;
};

const interleave = (
    series: readonly CatalogSeries[],
    movies: readonly CatalogSeries[],
    limit: number,
): CatalogSeries[] => {
    const merged: CatalogSeries[] = [];
    const longest = Math.max(series.length, movies.length);

    for (let index = 0; index < longest && merged.length < limit; index += 1) {
        const nextSeries = series[index];
        if (nextSeries) merged.push(nextSeries);

        const nextMovie = movies[index];
        if (nextMovie && merged.length < limit) merged.push(nextMovie);
    }

    return merged;
};

export const getTmdbCatalogFeed = async (
    catalog: readonly CatalogSeries[],
    options: TmdbCatalogFeedOptions = {},
    sources: TmdbCatalogFeedSources = defaultSources,
): Promise<CatalogSeries[]> => {
    const query = options.query?.trim() ?? "";
    const limit = Number.isSafeInteger(options.limit) && options.limit! > 0
        ? options.limit!
        : TMDB_CATALOG_LIMIT;
    const searching = query.length >= TMDB_CATALOG_MIN_QUERY_LENGTH;

    const [tvItems, movieItems, imageBaseUrl, tvGenres, movieGenres] = await Promise.all([
        searching ? sources.tvSearch(query) : sources.tvLists(),
        searching ? sources.movieSearch(query) : sources.movieLists(),
        sources.imageBaseUrl(),
        sources.genres("tv"),
        sources.genres("movie"),
    ]);

    const mappedSeries = mapTmdbListToCatalog(tvItems, catalog, limit, {
        createFallback: (item) => virtualSeriesFromListItem(
            item,
            imageBaseUrl,
            genreNamesFromIds(item.genre_ids, tvGenres),
        ),
    });

    const virtualSeries = mappedSeries.series.filter((series) => isVirtualTmdbKey(series.key));
    const virtualMovies = dedupeMovies(movieItems)
        .slice(0, limit)
        .map((item) => virtualSeriesFromMovieListItem(
            item,
            imageBaseUrl,
            genreNamesFromIds(item.genre_ids, movieGenres),
        ));

    return interleave(virtualSeries, virtualMovies, limit);
};
