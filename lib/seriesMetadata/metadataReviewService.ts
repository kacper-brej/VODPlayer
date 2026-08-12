import "server-only";
import { loadMetadataReviewSnapshot } from "./seriesMetadataRepository";
import type { MetadataReviewItem, MetadataReviewReason } from "@/lib/upload/uploadWorkflowTypes";

export const listMetadataReview = async (titles: Map<string, string> = new Map()): Promise<MetadataReviewItem[]> => {
    const snapshot = await loadMetadataReviewSnapshot();
    return snapshot.map((item) => {
        const savedReason = item.reviewReason as MetadataReviewReason | null;
        const skipped = item.reviewState === "skipped";
        const hasIdentity = Object.keys(item.externalIds).length > 0;
        const metadataReason: MetadataReviewReason | null = skipped
            ? savedReason
            : !hasIdentity
                ? savedReason === "partial-match" ? "partial-match" : "no-match"
                : !item.externalIds.tmdb
                    ? "missing-tmdb"
                    : savedReason === "uncertain-season" || (item.groupId !== null && item.seasonNumber === null)
                        ? "uncertain-season"
                        : null;
        const reason = !skipped && metadataReason === null
            && !item.artwork.some((image) => image.kind === "poster" && image.isPrimary)
            ? "missing-poster" as const
            : metadataReason;
        return {
            seriesKey: item.seriesKey,
            title: titles.get(item.seriesKey) ?? item.seriesKey,
            groupId: item.groupId,
            seasonNumber: item.seasonNumber,
            state: skipped ? "skipped" as const : reason ? "pending" as const : "ready" as const,
            reason,
            externalIds: item.externalIds,
            externalIdSources: item.externalIdSources,
            artwork: item.artwork,
        };
    });
};
