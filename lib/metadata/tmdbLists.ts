import "server-only";
import {
    validateTmdbTvListResponse,
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
} as const;

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

export const getTmdbPopularTv = (): Promise<DataResult<TmdbTvListItem[]>> =>
    fetchTvList("/tv/popular?language=pl-PL", TMDB_TV_LIST_CACHE_TTL_MS.popular);

export const getTmdbTopRatedTv = (): Promise<DataResult<TmdbTvListItem[]>> =>
    fetchTvList("/tv/top_rated?language=pl-PL", TMDB_TV_LIST_CACHE_TTL_MS.topRated);

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
