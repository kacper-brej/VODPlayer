import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import { withTransaction } from "@/lib/db/transaction";

interface ExistingArtworkRow extends RowDataPacket {
    id: number;
    storage_key: string | null;
}

interface StorageKeyRow extends RowDataPacket {
    storage_key: string;
}

export interface ManualArtworkRecord {
    seriesKey: string;
    kind: "poster" | "backdrop" | "logo";
    storageKey: string;
    width: number;
    height: number;
    dominantColor: string;
    placeholder: string;
}

export interface SavedArtworkRecord {
    id: number;
    url: string;
    replacedStorageKeys: string[];
}

export const replaceManualArtworkRecord = async (
    input: ManualArtworkRecord,
): Promise<SavedArtworkRecord | null> => withTransaction(async (connection) => {
    const [identities] = await connection.execute<RowDataPacket[]>(
        "SELECT series_key FROM series_identities WHERE series_key = ? LIMIT 1 FOR UPDATE",
        [input.seriesKey],
    );
    if (identities.length === 0) return null;

    const [existing] = await connection.execute<ExistingArtworkRow[]>(
        `SELECT id, storage_key FROM series_artwork
         WHERE series_key = ? AND kind = ? AND provider = 'manual'
         FOR UPDATE`,
        [input.seriesKey, input.kind],
    );

    await connection.execute(
        "UPDATE series_artwork SET is_primary = 0 WHERE series_key = ? AND kind = ?",
        [input.seriesKey, input.kind],
    );

    const provisionalUrl = `b2:${input.storageKey}`;
    const [insert] = await connection.execute<ResultSetHeader>(
        `INSERT INTO series_artwork
            (series_key, kind, url, storage_key, width, height, provider, language,
             is_primary, match_source, dominant_color, placeholder, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'manual', NULL, 1, 'manual', ?, ?, NOW())`,
        [
            input.seriesKey,
            input.kind,
            provisionalUrl,
            input.storageKey,
            input.width,
            input.height,
            input.dominantColor,
            input.placeholder,
        ],
    );

    const url = `/api/artwork?id=${insert.insertId}`;
    await connection.execute("UPDATE series_artwork SET url = ? WHERE id = ?", [url, insert.insertId]);
    await connection.execute(
        "DELETE FROM series_artwork WHERE series_key = ? AND kind = ? AND provider = 'manual' AND id <> ?",
        [input.seriesKey, input.kind, insert.insertId],
    );

    return {
        id: insert.insertId,
        url,
        replacedStorageKeys: existing
            .map((row) => row.storage_key)
            .filter((key): key is string => key !== null),
    };
});

export const findArtworkStorageKey = async (artworkId: number): Promise<string | null> => {
    try {
        const [rows] = await getDbPool().execute<StorageKeyRow[]>(
            `SELECT storage_key FROM series_artwork
             WHERE id = ? AND storage_key IS NOT NULL LIMIT 1`,
            [artworkId],
        );
        return rows[0]?.storage_key ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
