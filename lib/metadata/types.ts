import type { DataResult } from "@/lib/core/dataResult";

export type ProviderId = "anilist" | "tmdb" | "jikan";

export interface SeriesCandidate {
    providerId: ProviderId;
    externalId: string;
    title: string;
    altTitles: string[];
    year: number | null;
    format: string | null;
    coverImage: string | null;
}

export interface ProviderSeriesTitles {
    primary: string;
    romaji: string | null;
    english: string | null;
    native: string | null;
}

export interface ProviderSeries {
    providerId: ProviderId;
    externalId: string;
    malId: number | null;
    titles: ProviderSeriesTitles;
    synonyms: string[];
    synopsis: string | null;
    score: number | null;
    ageRating: string | null;
    year: number | null;
    genres: string[];
    studio: string | null;
}

export type ProviderArtworkKind = "poster" | "backdrop" | "logo";

export interface ProviderArtwork {
    kind: ProviderArtworkKind;
    url: string;
    width: number | null;
    height: number | null;
    language: string | null;
}

export interface ProviderEpisode {
    number: number;
    title: string | null;
    synopsis: string | null;
    stillUrl: string | null;
}

export interface MetadataProvider {
    id: ProviderId;
    searchSeries(query: string): Promise<DataResult<SeriesCandidate[]>>;
    getSeries(externalId: string): Promise<DataResult<ProviderSeries>>;
    getArtwork?(externalId: string): Promise<DataResult<ProviderArtwork[]>>;
    getEpisodes?(externalId: string): Promise<DataResult<ProviderEpisode[]>>;
}
