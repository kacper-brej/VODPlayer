import "server-only";
import type { PoolConnection } from "mysql2/promise";
import { downloadAndProcessArtwork } from "@/lib/artwork/artworkProcessor";
import { withTransaction } from "@/lib/db/transaction";
import { syncSeriesGenres, upsertCoverMetadata, type CoverMetadataWrite } from "./coverMetadataRepository";

const validate = (input: CoverMetadataWrite) => {
    if (!input.title.trim() || input.title.length > 255) throw new Error("invalid_series_key");
    if ((input.metadataProvider === null || input.metadataProvider === undefined) !== (input.externalId === null || input.externalId === undefined)) {
        throw new Error("invalid_metadata_identity");
    }
};

export const prepareCoverMetadata = async (input: CoverMetadataWrite): Promise<CoverMetadataWrite> => {
    validate(input);
    if (input.dominantColor && input.placeholder) return input;
    const signalSource = input.backdropImage ?? input.coverImage;
    if (!signalSource) return input;
    try {
        const processed = await downloadAndProcessArtwork(signalSource);
        return { ...input, dominantColor: input.dominantColor ?? processed.dominantColor, placeholder: input.placeholder ?? processed.placeholder };
    } catch (error) {
        console.warn("Nie udało się obliczyć sygnałów grafiki", error);
        return input;
    }
};

export const savePreparedCoverMetadata = async (input: CoverMetadataWrite, db: PoolConnection): Promise<void> => {
    await upsertCoverMetadata(input, db);
    if (input.genres !== undefined) await syncSeriesGenres(input.title, input.genres, db);
};

export const saveCoverMetadata = async (input: CoverMetadataWrite): Promise<void> => {
    const prepared = await prepareCoverMetadata(input);
    await withTransaction((db) => savePreparedCoverMetadata(prepared, db));
};
