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

export interface JikanSearchOption {
    malId: number;
    title: string;
    year: number | null;
    type: string | null;
    coverImage: string | null;
}

export interface JikanEpisodeOption {
    number: number;
    title: string | null;
}

export interface JikanSelection {
    malId: number;
    title: string;
    coverImage: string | null;
    backdropImage: string | null;
    synopsis: string | null;
    rating: string | null;
    ageRating: string | null;
    year: number | null;
    genres: string[];
    studio: string | null;
    episodes: JikanEpisodeOption[];
}

export interface UploadChunkResponse {
    success: boolean;
    episodeKey: string;
    chunkIndex: number;
    totalChunks: number;
    completed: boolean;
    metadataStatus: string;
    durationSeconds: number | null;
}

export interface UploadWorkflowSetup {
    series: UploadSeriesOption[];
    groups: UploadSeriesGroupOption[];
    unauthorized: boolean;
    unavailable: boolean;
}
