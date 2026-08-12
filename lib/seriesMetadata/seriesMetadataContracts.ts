import type { MetadataArtworkOption, MetadataReviewReason } from "@/lib/upload/uploadWorkflowTypes";

export type ExternalIdProvider = "mal" | "anilist" | "tmdb" | "tvdb";
export type ArtworkProvider = "anilist" | "tmdb" | "jikan" | "manual";
export type ArtworkKind = "poster" | "backdrop" | "logo";
export type ArtworkPrimaryPolicy = "force" | "if-absent" | "never";
export type MatchSource = "auto" | "manual";
export type TitleKind = "primary" | "romaji" | "english" | "native" | "synonym";
export type ReviewState = "pending" | "skipped";

export interface ExternalIdWrite {
    provider: ExternalIdProvider;
    externalId: string;
    matchSource: MatchSource;
}

export interface SeriesTitleWrite {
    title: string;
    kind: TitleKind;
}

export interface ArtworkCandidateWrite {
    kind: ArtworkKind;
    url: string;
    width: number | null;
    height: number | null;
    provider: ArtworkProvider;
    language: string | null;
    primary: ArtworkPrimaryPolicy;
    matchSource: MatchSource;
    dominantColor: string | null;
    placeholder: string | null;
}

export interface ReviewDecisionWrite {
    state: ReviewState;
    reason: Exclude<MetadataReviewReason, "missing-poster"> | null;
    preserveSkipped?: boolean;
}

export interface SeriesMetadataLookup {
    seriesKey: string;
    externalIds: Record<string, string>;
    externalIdSources: Record<string, MatchSource>;
    titles: SeriesTitleWrite[];
    artwork: MetadataArtworkOption[];
    reviewDecision: { state: ReviewState; reason: string | null } | null;
}

export interface MetadataReviewSnapshotItem {
    seriesKey: string;
    groupId: number | null;
    seasonNumber: number | null;
    reviewState: ReviewState | null;
    reviewReason: string | null;
    externalIds: Record<string, string>;
    externalIdSources: Record<string, MatchSource>;
    artwork: MetadataArtworkOption[];
}
