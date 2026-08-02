import { createRateLimitedClient } from "@/lib/metadata/rateLimitedClient";
import type {
    MetadataProvider,
    ProviderArtwork,
    ProviderEpisode,
    ProviderSeries,
    SeriesCandidate,
} from "@/lib/metadata/types";
import {
    validateJikanAnimeListResponse,
    validateJikanAnimeResponse,
    validateJikanEpisodesResponse,
    type JikanAnime,
} from "@/lib/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/dataResult";

const MAX_EPISODE_PAGES = 500;

const client = createRateLimitedClient({
    providerId: "jikan",
    baseUrl: process.env.NEXT_PUBLIC_MOVIE_API_URL ?? "",
    minRequestIntervalMs: 400,
    cacheTtlMs: 60 * 60 * 1000,
    cacheMaxEntries: 128,
    maxRetries: 3,
});

export const fetchJikanRaw = (
    path: string,
    options?: RequestInit,
    validator?: (value: unknown) => boolean,
): Promise<DataResult<unknown>> => client.fetchResult(path, options, validator);

const mapAgeRating = (classification: string | null): string | null => {
    if (!classification) return null;
    if (classification.startsWith("G")) return "7+";
    if (classification.startsWith("PG-13")) return "12+";
    if (classification.startsWith("PG")) return "7+";
    if (classification.startsWith("R - 17")) return "16+";
    if (classification.startsWith("R+")) return "18+";
    return null;
};

const mapAnimeToSeries = (anime: JikanAnime): ProviderSeries => ({
    providerId: "jikan",
    externalId: String(anime.mal_id),
    malId: anime.mal_id,
    titles: {
        primary: anime.title,
        romaji: null,
        english: anime.title_english,
        native: null,
    },
    synonyms: [],
    synopsis: anime.synopsis ?? null,
    score: anime.score ?? null,
    ageRating: mapAgeRating(anime.rating),
    year: anime.year ?? null,
    genres: (anime.genres ?? []).map((genre) => genre.name.trim()).filter((name) => name !== ""),
    studio: anime.studios?.[0]?.name.trim() || null,
});

const mapAnimeToArtwork = (anime: JikanAnime): ProviderArtwork[] => {
    const artwork: ProviderArtwork[] = [];
    const poster = anime.images.webp.large_image_url || anime.images.jpg.image_url;

    if (poster) {
        artwork.push({ kind: "poster", url: poster, width: null, height: null, language: null });
    }

    const backdrop = anime.trailer?.images?.maximum_image_url ?? null;

    if (backdrop) {
        artwork.push({ kind: "backdrop", url: backdrop, width: null, height: null, language: null });
    }

    return artwork;
};

const fetchAnime = async (externalId: string): Promise<DataResult<JikanAnime>> => {
    const path = `/anime/${encodeURIComponent(externalId)}`;
    const response = await client.fetchResult(
        path,
        undefined,
        (value) => validateJikanAnimeResponse(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateJikanAnimeResponse(response.data);
    return result.ok ? dataSuccess(result.data.data) : dataFailure("invalid_response");
};

const searchSeries = async (query: string): Promise<DataResult<SeriesCandidate[]>> => {
    const path = `/anime?q=${encodeURIComponent(query)}&limit=8&sfw=true`;
    const response = await client.fetchResult(
        path,
        undefined,
        (value) => validateJikanAnimeListResponse(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateJikanAnimeListResponse(response.data);
    if (!result.ok) return dataFailure("invalid_response");

    const candidates: SeriesCandidate[] = result.data.data
        .filter((anime) => !anime.rating?.startsWith("Rx"))
        .map((anime) => ({
            providerId: "jikan",
            externalId: String(anime.mal_id),
            title: anime.title_english?.trim() || anime.title,
            altTitles: anime.title_english && anime.title_english !== anime.title ? [anime.title] : [],
            year: anime.year ?? null,
            format: anime.type ?? null,
            coverImage: anime.images.webp.large_image_url || anime.images.jpg.image_url || null,
        }));

    return dataSuccess(candidates);
};

const getSeries = async (externalId: string): Promise<DataResult<ProviderSeries>> => {
    const anime = await fetchAnime(externalId);
    if (anime.kind === "error") return anime;

    return dataSuccess(mapAnimeToSeries(anime.data));
};

const getArtwork = async (externalId: string): Promise<DataResult<ProviderArtwork[]>> => {
    const anime = await fetchAnime(externalId);
    if (anime.kind === "error") return anime;

    return dataSuccess(mapAnimeToArtwork(anime.data));
};

const getEpisodes = async (externalId: string): Promise<DataResult<ProviderEpisode[]>> => {
    const episodes: ProviderEpisode[] = [];
    const seenNumbers = new Set<number>();
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= MAX_EPISODE_PAGES) {
        const path = `/anime/${encodeURIComponent(externalId)}/episodes?page=${page}`;
        const response = await client.fetchResult(
            path,
            undefined,
            (value) => validateJikanEpisodesResponse(value).ok,
        );

        if (response.kind === "error") return response;

        const result = validateJikanEpisodesResponse(response.data);
        if (!result.ok) return dataFailure("invalid_response");

        for (const episode of result.data.data) {
            if (!seenNumbers.has(episode.mal_id)) {
                seenNumbers.add(episode.mal_id);
                episodes.push({
                    number: episode.mal_id,
                    title: episode.title?.trim() || null,
                    synopsis: null,
                    stillUrl: null,
                });
            }
        }

        hasNext = result.data.pagination.has_next_page;
        page += 1;
    }

    if (hasNext) return dataFailure("server");

    return dataSuccess(episodes);
};

export const jikanProvider: MetadataProvider = {
    id: "jikan",
    searchSeries,
    getSeries,
    getArtwork,
    getEpisodes,
};
