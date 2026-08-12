import { createRateLimitedClient } from "@/lib/metadata/rateLimitedClient";
import type {
    MetadataProvider,
    ProviderArtwork,
    ProviderSeries,
    SeriesCandidate,
} from "@/lib/metadata/types";
import {
    validateAniListMediaResponse,
    validateAniListSearchResponse,
    type AniListMedia,
} from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const SEARCH_PER_PAGE = 10;

const client = createRateLimitedClient({
    providerId: "anilist",
    baseUrl: ANILIST_ENDPOINT,
    minRequestIntervalMs: 700,
    cacheTtlMs: 60 * 60 * 1000,
    cacheMaxEntries: 128,
    maxRetries: 3,
});

const MEDIA_FIELDS = `
    id
    idMal
    title { romaji english native }
    synonyms
    description(asHtml: false)
    seasonYear
    format
    episodes
    averageScore
    genres
    studios(isMain: true) { nodes { name } }
    coverImage { extraLarge large color }
    bannerImage
    isAdult
`;

const SEARCH_QUERY = `
    query ($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
            media(search: $search, type: ANIME, isAdult: false) {
                ${MEDIA_FIELDS}
            }
        }
    }
`;

const MEDIA_QUERY = `
    query ($id: Int) {
        Media(id: $id, type: ANIME) {
            ${MEDIA_FIELDS}
        }
    }
`;

const graphqlRequest = async (
    query: string,
    variables: Record<string, unknown>,
    validator: (value: unknown) => boolean,
): Promise<DataResult<unknown>> => {
    const cacheKey = `?${encodeURIComponent(JSON.stringify({ query, variables }))}`;

    return client.fetchResult(
        cacheKey,
        {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query, variables }),
        },
        validator,
    );
};

const stripHtml = (input: string): string => {
    const withBreaks = input.replace(/<br\s*\/?>/gi, "\n");
    const withoutTags = withBreaks.replace(/<[^>]+>/g, "");
    const decoded = withoutTags
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#0?39;/g, "'")
        .replace(/&nbsp;/g, " ");

    return decoded.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
};

const preferredTitle = (title: AniListMedia["title"]): string =>
    title.english?.trim() || title.romaji?.trim() || title.native?.trim() || "";

const mapMediaToSeries = (media: AniListMedia): ProviderSeries => ({
    providerId: "anilist",
    externalId: String(media.id),
    malId: media.idMal,
    titles: {
        primary: preferredTitle(media.title),
        romaji: media.title.romaji,
        english: media.title.english,
        native: media.title.native,
    },
    synonyms: media.synonyms,
    synopsis: media.description ? (stripHtml(media.description) || null) : null,
    score: media.averageScore !== null ? Math.round(media.averageScore) / 10 : null,
    ageRating: null,
    year: media.seasonYear,
    genres: media.genres,
    studio: media.studios?.nodes[0]?.name ?? null,
});

const mapMediaToArtwork = (media: AniListMedia): ProviderArtwork[] => {
    const artwork: ProviderArtwork[] = [];
    const poster = media.coverImage?.extraLarge || media.coverImage?.large || null;

    if (poster) {
        artwork.push({ kind: "poster", url: poster, width: null, height: null, language: null });
    }

    if (media.bannerImage) {
        artwork.push({ kind: "backdrop", url: media.bannerImage, width: null, height: null, language: null });
    }

    return artwork;
};

const fetchMediaById = async (externalId: string): Promise<DataResult<AniListMedia>> => {
    const id = Number(externalId);
    if (!Number.isSafeInteger(id)) return dataFailure("invalid_response");

    const response = await graphqlRequest(
        MEDIA_QUERY,
        { id },
        (value) => validateAniListMediaResponse(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateAniListMediaResponse(response.data);
    if (!result.ok || !result.data.data) return dataFailure("invalid_response");

    return dataSuccess(result.data.data.Media);
};

const searchSeries = async (query: string): Promise<DataResult<SeriesCandidate[]>> => {
    const response = await graphqlRequest(
        SEARCH_QUERY,
        { search: query, perPage: SEARCH_PER_PAGE },
        (value) => validateAniListSearchResponse(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateAniListSearchResponse(response.data);
    if (!result.ok || !result.data.data) return dataFailure("invalid_response");

    const candidates: SeriesCandidate[] = result.data.data.Page.media
        .filter((media) => !media.isAdult)
        .map((media) => {
            const title = preferredTitle(media.title);
            const altTitles = Array.from(new Set(
                [media.title.romaji, media.title.native, ...media.synonyms]
                    .filter((value): value is string => Boolean(value && value.trim()))
                    .filter((value) => value !== title),
            ));

            return {
                providerId: "anilist",
                externalId: String(media.id),
                title,
                altTitles,
                year: media.seasonYear,
                format: media.format,
                coverImage: media.coverImage?.extraLarge || media.coverImage?.large || null,
            };
        });

    return dataSuccess(candidates);
};

const getSeries = async (externalId: string): Promise<DataResult<ProviderSeries>> => {
    const media = await fetchMediaById(externalId);
    if (media.kind === "error") return media;

    return dataSuccess(mapMediaToSeries(media.data));
};

const getArtwork = async (externalId: string): Promise<DataResult<ProviderArtwork[]>> => {
    const media = await fetchMediaById(externalId);
    if (media.kind === "error") return media;

    return dataSuccess(mapMediaToArtwork(media.data));
};

export const anilistProvider: MetadataProvider = {
    id: "anilist",
    searchSeries,
    getSeries,
    getArtwork,
};
