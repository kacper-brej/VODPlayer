export interface UploadEpisodeOption {
    key: string;
    number: number;
    durationSeconds: number | null;
}

export interface UploadSeriesOption {
    key: string;
    title: string;
    metadataProvider: string | null;
    externalId: number | null;
    groupId: number | null;
    seasonNumber: number | null;
    episodes: UploadEpisodeOption[];
}

export interface UploadSeriesGroupOption {
    id: number;
    baseTitle: string;
}

export type MetadataProviderId = "anilist" | "tmdb" | "jikan";

export interface MetadataSearchOption {
    providerId: MetadataProviderId;
    externalId: string;
    title: string;
    altTitles: string[];
    year: number | null;
    type: string | null;
    coverImage: string | null;
}

export type MetadataReviewReason = "no-match" | "partial-match" | "missing-tmdb" | "uncertain-season" | "missing-poster";
export type MetadataArtworkKind = "poster" | "backdrop" | "logo";

export interface MetadataArtworkOption {
    id: number;
    kind: MetadataArtworkKind;
    url: string;
    width: number | null;
    height: number | null;
    provider: string;
    language: string | null;
    isPrimary: boolean;
    matchSource: "auto" | "manual";
}

export interface MetadataReviewItem {
    seriesKey: string;
    title: string;
    groupId: number | null;
    seasonNumber: number | null;
    state: "pending" | "skipped" | "ready";
    reason: MetadataReviewReason | null;
    externalIds: Record<string, string>;
    externalIdSources: Record<string, "auto" | "manual">;
    artwork: MetadataArtworkOption[];
}

export interface MetadataEpisodeOption {
    number: number;
    title: string | null;
}

export interface MetadataSelection {
    providerId: MetadataProviderId;
    externalId: string;
    malId: number | null;
    title: string;
    coverImage: string | null;
    backdropImage: string | null;
    synopsis: string | null;
    rating: string | null;
    ageRating: string | null;
    year: number | null;
    genres: string[];
    studio: string | null;
    episodes: MetadataEpisodeOption[];
}

export interface UploadWorkflowSetup {
    series: UploadSeriesOption[];
    groups: UploadSeriesGroupOption[];
    metadataReview: MetadataReviewItem[];
    unauthorized: boolean;
    unavailable: boolean;
}
