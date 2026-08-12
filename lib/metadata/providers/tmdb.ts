import { fetchTmdbResult, getTmdbImageBaseUrl } from "@/lib/metadata/tmdbConfig";
import { rankTmdbArtwork } from "@/lib/metadata/artworkRanking";
import type {
    MetadataProvider,
    ProviderArtwork,
    ProviderEpisode,
    ProviderSeries,
    SeriesCandidate,
} from "@/lib/metadata/types";
import {
    validateTmdbImagesResponse,
    validateTmdbSeasonResponse,
    validateTmdbTvDetails,
    validateTmdbTvSearchResponse,
    type TmdbSeasonResponse,
    type TmdbSeasonSummary,
    type TmdbTvDetails,
} from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

const EXTERNAL_ID_PATTERN = /^tv:(\d+)$/;

const parseExternalId = (externalId: string): number | null => {
    const match = EXTERNAL_ID_PATTERN.exec(externalId);
    if (!match) return null;

    const id = Number(match[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const mapAgeRating = (rating: string | null): string | null => {
    if (!rating) return null;

    const normalized = rating.toUpperCase();
    if (["TV-Y", "TV-Y7", "TV-G", "TV-PG", "G", "PG"].includes(normalized)) return "7+";
    if (["TV-14", "PG-13"].includes(normalized)) return "12+";
    if (["TV-MA", "R"].includes(normalized)) return "16+";
    if (normalized === "NC-17") return "18+";

    return null;
};

const yearFromDate = (date: string | null): number | null => {
    if (!date) return null;
    const year = Number(date.slice(0, 4));
    return Number.isSafeInteger(year) && year > 0 ? year : null;
};

const mapDetailsToSeries = (details: TmdbTvDetails): ProviderSeries => {
    const usRating = details.content_ratings?.results.find((entry) => entry.iso_3166_1 === "US")?.rating ?? null;

    return {
        providerId: "tmdb",
        externalId: `tv:${details.id}`,
        malId: null,
        titles: {
            primary: details.name,
            romaji: null,
            english: details.name,
            native: details.original_name,
        },
        synonyms: [],
        synopsis: details.overview || null,
        score: details.vote_average,
        ageRating: mapAgeRating(usRating),
        year: yearFromDate(details.first_air_date),
        genres: details.genres.map((genre) => genre.name),
        studio: details.production_companies[0]?.name ?? null,
    };
};

const fetchTvDetails = async (id: number): Promise<DataResult<TmdbTvDetails>> => {
    const response = await fetchTmdbResult(
        `/tv/${id}?append_to_response=content_ratings`,
        (value) => validateTmdbTvDetails(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateTmdbTvDetails(response.data);
    return result.ok ? dataSuccess(result.data) : dataFailure("invalid_response");
};

const searchSeries = async (query: string): Promise<DataResult<SeriesCandidate[]>> => {
    const response = await fetchTmdbResult(
        `/search/tv?query=${encodeURIComponent(query)}`,
        (value) => validateTmdbTvSearchResponse(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateTmdbTvSearchResponse(response.data);
    if (!result.ok) return dataFailure("invalid_response");

    const candidates: SeriesCandidate[] = result.data.results.map((item) => ({
        providerId: "tmdb",
        externalId: `tv:${item.id}`,
        title: item.name,
        altTitles: item.original_name !== item.name ? [item.original_name] : [],
        year: yearFromDate(item.first_air_date),
        format: "TV",
        coverImage: null,
    }));

    return dataSuccess(candidates);
};

const getSeries = async (externalId: string): Promise<DataResult<ProviderSeries>> => {
    const id = parseExternalId(externalId);
    if (id === null) return dataFailure("invalid_response");

    const details = await fetchTvDetails(id);
    if (details.kind === "error") return details;

    return dataSuccess(mapDetailsToSeries(details.data));
};

const getArtwork = async (externalId: string): Promise<DataResult<ProviderArtwork[]>> => {
    const id = parseExternalId(externalId);
    if (id === null) return dataFailure("invalid_response");

    const [baseUrlResult, imagesResponse] = await Promise.all([
        getTmdbImageBaseUrl(),
        fetchTmdbResult(
            `/tv/${id}/images?include_image_language=en,ja,null`,
            (value) => validateTmdbImagesResponse(value).ok,
        ),
    ]);

    if (baseUrlResult.kind === "error") return baseUrlResult;
    if (imagesResponse.kind === "error") return imagesResponse;

    const result = validateTmdbImagesResponse(imagesResponse.data);
    if (!result.ok) return dataFailure("invalid_response");

    return dataSuccess(rankTmdbArtwork(result.data, baseUrlResult.data));
};

const fetchSeasonEpisodes = async (id: number, seasonNumber: number): Promise<DataResult<TmdbSeasonResponse>> => {
    const response = await fetchTmdbResult(
        `/tv/${id}/season/${seasonNumber}`,
        (value) => validateTmdbSeasonResponse(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateTmdbSeasonResponse(response.data);
    return result.ok ? dataSuccess(result.data) : dataFailure("invalid_response");
};

const getEpisodes = async (externalId: string): Promise<DataResult<ProviderEpisode[]>> => {
    const id = parseExternalId(externalId);
    if (id === null) return dataFailure("invalid_response");

    const [season, baseUrlResult] = await Promise.all([
        fetchSeasonEpisodes(id, 1),
        getTmdbImageBaseUrl(),
    ]);

    if (season.kind === "error") return season;
    if (baseUrlResult.kind === "error") return baseUrlResult;

    const episodes: ProviderEpisode[] = season.data.episodes.map((episode) => ({
        number: episode.episode_number,
        title: episode.name?.trim() || null,
        synopsis: episode.overview?.trim() || null,
        stillUrl: episode.still_path ? `${baseUrlResult.data}original${episode.still_path}` : null,
    }));

    return dataSuccess(episodes);
};

export interface TmdbSeasonEpisodeStill {
    number: number;
    title: string | null;
    synopsis: string | null;
    stillPath: string | null;
}

export const getTmdbSeasonEpisodes = async (
    externalId: string,
    seasonNumber: number,
): Promise<DataResult<TmdbSeasonEpisodeStill[]>> => {
    const id = parseExternalId(externalId);
    if (id === null) return dataFailure("invalid_response");

    const season = await fetchSeasonEpisodes(id, seasonNumber);
    if (season.kind === "error") return season;

    const episodes: TmdbSeasonEpisodeStill[] = season.data.episodes.map((episode) => ({
        number: episode.episode_number,
        title: episode.name?.trim() || null,
        synopsis: episode.overview?.trim() || null,
        stillPath: episode.still_path,
    }));

    return dataSuccess(episodes);
};

export const getTmdbSeasonSummaries = async (externalId: string): Promise<DataResult<TmdbSeasonSummary[]>> => {
    const id = parseExternalId(externalId);
    if (id === null) return dataFailure("invalid_response");

    const details = await fetchTvDetails(id);
    if (details.kind === "error") return details;

    return dataSuccess(details.data.seasons);
};

export const tmdbProvider: MetadataProvider = {
    id: "tmdb",
    searchSeries,
    getSeries,
    getArtwork,
    getEpisodes,
};
