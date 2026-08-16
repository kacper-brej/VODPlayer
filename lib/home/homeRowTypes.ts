import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import type { DataErrorReason } from "@/lib/core/dataResult";

export type HomeRowId =
    | "trending-today"
    | "newest-local"
    | "popular-now"
    | "top-rated"
    | "on-the-air"
    | "watchlist"
    | "recommendations";

export type HomeRowSource =
    | "tmdb-trending-day"
    | "local-newest"
    | "tmdb-popular"
    | "tmdb-top-rated"
    | "tmdb-on-the-air"
    | "local-watchlist"
    | "tmdb-recommendations";

export type HomeRowVariant = "classic" | "ranking";

export interface HomeRow {
    id: HomeRowId;
    title: string;
    kicker: string;
    variant: HomeRowVariant;
    source: HomeRowSource;
    items: CatalogSeries[];
}

export interface HomeRowDiagnostics {
    inputCount: number;
    matchedCount: number;
    rejectedCount: number;
    duplicateCount: number;
}

export type HomeRowOmissionReason =
    | "insufficient_matches"
    | "empty_watchlist"
    | "no_seed"
    | "provider_unavailable";

export type HomeRowResult =
    | { kind: "ready"; row: HomeRow; diagnostics?: HomeRowDiagnostics }
    | {
        kind: "omitted";
        id: HomeRowId;
        source: HomeRowSource;
        reason: HomeRowOmissionReason;
        diagnostics?: HomeRowDiagnostics;
    }
    | {
        kind: "error";
        id: HomeRowId;
        source: HomeRowSource;
        reason: DataErrorReason;
        status?: number;
    };
