import "server-only";
import { downloadAndProcessArtwork } from "@/lib/artwork/artworkProcessor";
import { withTransaction } from "@/lib/db/transaction";
import { prepareCoverMetadata, savePreparedCoverMetadata } from "./coverMetadataService";
import type { CoverMetadataWrite } from "./coverMetadataRepository";
import type { ArtworkCandidateWrite, ExternalIdWrite, ReviewDecisionWrite, SeriesTitleWrite } from "./seriesMetadataContracts";
import { mapWithConcurrency } from "@/lib/core/mapWithConcurrency";
import {
    clearManualMetadata, loadSeriesMetadata, restorePreferredArtwork, selectArtworkForUpdate,
    setPrimaryArtwork, upsertArtworkCandidates, upsertExternalId, upsertReviewDecision, upsertTitles,
} from "./seriesMetadataRepository";

const assertSeriesKey = (seriesKey: string) => {
    if (!seriesKey.trim() || seriesKey.length > 255) throw new Error("invalid_series_key");
};

export const ARTWORK_PROCESSING_CONCURRENCY = 3;
export const ARTWORK_PROCESSING_BUDGET_MS = 15_000;

export const prepareArtworkCandidates = async (items: ArtworkCandidateWrite[]): Promise<ArtworkCandidateWrite[]> => {
    const deadline = Date.now() + ARTWORK_PROCESSING_BUDGET_MS;
    return mapWithConcurrency(items, ARTWORK_PROCESSING_CONCURRENCY, async (item) => {
        if (item.primary === "never" || (item.dominantColor && item.placeholder)) return item;
        try {
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) return item;
            const processed = await downloadAndProcessArtwork(item.url, {}, {
                timeoutMs: Math.min(8_000, remainingMs),
            });
            return { ...item, dominantColor: item.dominantColor ?? processed.dominantColor, placeholder: item.placeholder ?? processed.placeholder };
        } catch (error) {
            console.warn("Nie udało się obliczyć sygnałów kandydata grafiki", error);
            return item;
        }
    });
};

export interface CompleteSeriesMetadataWrite {
    seriesKey: string;
    externalIds: ExternalIdWrite[];
    titles: SeriesTitleWrite[];
    artwork: ArtworkCandidateWrite[];
    cover: CoverMetadataWrite;
}

export const persistCompleteSeriesMetadata = async (input: CompleteSeriesMetadataWrite): Promise<void> => {
    assertSeriesKey(input.seriesKey);
    const [artwork, cover] = await Promise.all([
        prepareArtworkCandidates(input.artwork),
        prepareCoverMetadata(input.cover),
    ]);
    await withTransaction(async (db) => {
        for (const externalId of input.externalIds) await upsertExternalId(input.seriesKey, externalId, db);
        await upsertTitles(input.seriesKey, input.titles, db);
        await upsertArtworkCandidates(input.seriesKey, artwork, db);
        await savePreparedCoverMetadata(cover, db);
    });
};

export const getSeriesMetadata = loadSeriesMetadata;

export const saveReviewDecision = async (seriesKey: string, decision: ReviewDecisionWrite): Promise<void> => {
    assertSeriesKey(seriesKey);
    await withTransaction((db) => upsertReviewDecision(seriesKey, decision, db));
};

export const saveArtworkCandidates = async (seriesKey: string, items: ArtworkCandidateWrite[]): Promise<void> => {
    assertSeriesKey(seriesKey);
    const prepared = await prepareArtworkCandidates(items);
    await withTransaction((db) => upsertArtworkCandidates(seriesKey, prepared, db));
};

export const saveExternalId = async (seriesKey: string, input: ExternalIdWrite): Promise<void> => {
    assertSeriesKey(seriesKey);
    await withTransaction((db) => upsertExternalId(seriesKey, input, db));
};

export const selectSeriesArtwork = async (seriesKey: string, artworkId: number): Promise<boolean> => {
    assertSeriesKey(seriesKey);
    return withTransaction(async (db) => {
        const kind = await selectArtworkForUpdate(seriesKey, artworkId, db);
        if (!kind) return false;
        await setPrimaryArtwork(seriesKey, artworkId, kind, db);
        return true;
    });
};

export const undoManualSeriesMetadata = async (seriesKey: string): Promise<void> => {
    assertSeriesKey(seriesKey);
    await withTransaction(async (db) => {
        await clearManualMetadata(seriesKey, db);
        for (const kind of ["poster", "backdrop", "logo"] as const) await restorePreferredArtwork(seriesKey, kind, db);
    });
};
