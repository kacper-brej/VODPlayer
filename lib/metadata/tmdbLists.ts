import "server-only";
import {
    validateTmdbMovieListResponse,
    validateTmdbSearchResponse,
    validateTmdbTvListResponse,
    type TmdbMovieListItem,
    type TmdbSearchItem,
    type TmdbTvListItem,
} from "@/lib/core/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";
import { fetchTmdbResult } from "@/lib/metadata/tmdbConfig";

export type TmdbTrendingWindow = "day" | "week";

export const TMDB_TV_LIST_CACHE_TTL_MS = {
    trendingDay: 30 * 60 * 1000,
    trendingWeek: 2 * 60 * 60 * 1000,
    popular: 2 * 60 * 60 * 1000,
    topRated: 12 * 60 * 60 * 1000,
    onTheAir: 6 * 60 * 60 * 1000,
    recommendations: 12 * 60 * 60 * 1000,
    search: 15 * 60 * 1000,
} as const;

const pagePath = (path: string, page: number): string => {
    const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 500) : 1;
    return safePage === 1 ? path : `${path}&page=${safePage}`;
};

const normalizeListItem = (item: TmdbTvListItem): TmdbTvListItem => ({
    ...item,
    first_air_date: item.first_air_date?.trim() || null,
});

export const TMDB_TV_LIST_MAX_RETRIES = 1;

const fetchTvList = async (
    path: string,
    cacheTtlMs: number,
): Promise<DataResult<TmdbTvListItem[]>> => {
    const response = await fetchTmdbResult(
        path,
        (value) => validateTmdbTvListResponse(value).ok,
        { cacheTtlMs, maxRetries: TMDB_TV_LIST_MAX_RETRIES },
    );

    if (response.kind === "error") {
        if (response.reason === "unauthorized" || response.reason === "forbidden") {
            return dataFailure("server", response.status);
        }
        return response;
    }

    const parsed = validateTmdbTvListResponse(response.data);
    if (!parsed.ok) return dataFailure("invalid_response");

    const items = parsed.data.results.map(normalizeListItem);
    return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
};

export const getTmdbTrendingTv = async (
    window: TmdbTrendingWindow,
): Promise<DataResult<TmdbTvListItem[]>> => {
    if (window !== "day" && window !== "week") {
        return dataFailure("invalid_response");
    }

    const cacheTtlMs = window === "day"
        ? TMDB_TV_LIST_CACHE_TTL_MS.trendingDay
        : TMDB_TV_LIST_CACHE_TTL_MS.trendingWeek;

    return fetchTvList(`/trending/tv/${window}?language=pl-PL`, cacheTtlMs);
};

export const getTmdbPopularTv = (page = 1): Promise<DataResult<TmdbTvListItem[]>> =>
    fetchTvList(pagePath("/tv/popular?language=pl-PL", page), TMDB_TV_LIST_CACHE_TTL_MS.popular);

export const getTmdbTopRatedTv = (page = 1): Promise<DataResult<TmdbTvListItem[]>> =>
    fetchTvList(pagePath("/tv/top_rated?language=pl-PL", page), TMDB_TV_LIST_CACHE_TTL_MS.topRated);

export const getTmdbOnTheAirTv = (): Promise<DataResult<TmdbTvListItem[]>> =>
    fetchTvList(
        "/tv/on_the_air?language=pl-PL&timezone=Europe%2FWarsaw",
        TMDB_TV_LIST_CACHE_TTL_MS.onTheAir,
    );

export const getTmdbRecommendations = async (
    tmdbId: number,
): Promise<DataResult<TmdbTvListItem[]>> => {
    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
        return dataFailure("invalid_response");
    }

    return fetchTvList(
        `/tv/${tmdbId}/recommendations?language=pl-PL`,
        TMDB_TV_LIST_CACHE_TTL_MS.recommendations,
    );
};

const normalizeMovieListItem = (item: TmdbMovieListItem): TmdbMovieListItem => ({
    ...item,
    release_date: item.release_date?.trim() || null,
});

const fetchMovieList = async (
    path: string,
    cacheTtlMs: number,
): Promise<DataResult<TmdbMovieListItem[]>> => {
    const response = await fetchTmdbResult(
        path,
        (value) => validateTmdbMovieListResponse(value).ok,
        { cacheTtlMs, maxRetries: TMDB_TV_LIST_MAX_RETRIES },
    );

    if (response.kind === "error") {
        if (response.reason === "unauthorized" || response.reason === "forbidden") {
            return dataFailure("server", response.status);
        }
        return response;
    }

    const parsed = validateTmdbMovieListResponse(response.data);
    if (!parsed.ok) return dataFailure("invalid_response");

    const items = parsed.data.results.map(normalizeMovieListItem);
    return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
};

export const getTmdbPopularMovies = (page = 1): Promise<DataResult<TmdbMovieListItem[]>> =>
    fetchMovieList(pagePath("/movie/popular?language=pl-PL", page), TMDB_TV_LIST_CACHE_TTL_MS.popular);

export const getTmdbTopRatedMovies = (page = 1): Promise<DataResult<TmdbMovieListItem[]>> =>
    fetchMovieList(pagePath("/movie/top_rated?language=pl-PL", page), TMDB_TV_LIST_CACHE_TTL_MS.topRated);

export const getTmdbTrendingMovies = async (
    window: TmdbTrendingWindow,
): Promise<DataResult<TmdbMovieListItem[]>> => {
    if (window !== "day" && window !== "week") {
        return dataFailure("invalid_response");
    }

    const cacheTtlMs = window === "day"
        ? TMDB_TV_LIST_CACHE_TTL_MS.trendingDay
        : TMDB_TV_LIST_CACHE_TTL_MS.trendingWeek;

    return fetchMovieList(`/trending/movie/${window}?language=pl-PL`, cacheTtlMs);
};

const clampScore = (value: number | null | undefined): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.min(10, Math.max(0, value));
};

const nonNegativeInteger = (value: number | null | undefined): number => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
};

const searchGenreIds = (item: TmdbSearchItem): number[] =>
    (item.genre_ids ?? []).filter((id) => Number.isSafeInteger(id) && id > 0);

const searchTmdb = async (path: string): Promise<DataResult<TmdbSearchItem[]>> => {
    const response = await fetchTmdbResult(
        path,
        (value) => validateTmdbSearchResponse(value).ok,
        { cacheTtlMs: TMDB_TV_LIST_CACHE_TTL_MS.search, maxRetries: TMDB_TV_LIST_MAX_RETRIES },
    );

    if (response.kind === "error") {
        if (response.reason === "unauthorized" || response.reason === "forbidden") {
            return dataFailure("server", response.status);
        }
        return response;
    }

    const parsed = validateTmdbSearchResponse(response.data);
    if (!parsed.ok) return dataFailure("invalid_response");

    const items = parsed.data.results.filter((item) => Number.isSafeInteger(item.id) && item.id > 0);
    return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
};

const searchQueryPath = (kind: "tv" | "movie", query: string, page: number): string =>
    pagePath(
        `/search/${kind}?language=pl-PL&include_adult=false&query=${encodeURIComponent(query)}`,
        page,
    );

export const searchTmdbTvList = async (
    query: string,
    page = 1,
): Promise<DataResult<TmdbTvListItem[]>> => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return dataEmpty([]);

    const result = await searchTmdb(searchQueryPath("tv", trimmed, page));
    if (result.kind === "error") return result;

    const items: TmdbTvListItem[] = result.data
        .filter((item) => Boolean((item.name ?? item.title)?.trim()))
        .map((item) => ({
            id: item.id,
            name: (item.name ?? item.title ?? "").trim(),
            popularity: nonNegativeInteger(item.popularity),
            vote_average: clampScore(item.vote_average),
            vote_count: nonNegativeInteger(item.vote_count),
            first_air_date: item.first_air_date?.trim() || null,
            genre_ids: searchGenreIds(item),
            overview: item.overview ?? null,
            poster_path: item.poster_path ?? null,
            backdrop_path: item.backdrop_path ?? null,
        }));

    return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
};

export const searchTmdbMovieList = async (
    query: string,
    page = 1,
): Promise<DataResult<TmdbMovieListItem[]>> => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return dataEmpty([]);

    const result = await searchTmdb(searchQueryPath("movie", trimmed, page));
    if (result.kind === "error") return result;

    const items: TmdbMovieListItem[] = result.data
        .filter((item) => Boolean((item.title ?? item.name)?.trim()))
        .map((item) => ({
            id: item.id,
            title: (item.title ?? item.name ?? "").trim(),
            popularity: nonNegativeInteger(item.popularity),
            vote_average: clampScore(item.vote_average),
            vote_count: nonNegativeInteger(item.vote_count),
            release_date: item.release_date?.trim() || null,
            genre_ids: searchGenreIds(item),
            overview: item.overview ?? null,
            poster_path: item.poster_path ?? null,
            backdrop_path: item.backdrop_path ?? null,
        }));

    return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
};
