import "server-only";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import { withTransaction } from "@/lib/db/transaction";
import type { RegisteredAssetKey } from "@/lib/media/libraryRegistration";
import { libraryStoragePrefix } from "@/lib/media/libraryRegistration";

type Executor = Pool | PoolConnection;

interface AssetKeyRow extends RowDataPacket {
    series_key: string;
    episode_key: string;
    delivery: "hls" | "file";
}

interface FileRegistrationRow extends RowDataPacket {
    id: number;
    status: "pending" | "processing" | "ready" | "failed" | "deleting" | "delete_failed" | "deleted";
}

export const listRegisteredAssetKeys = async (
    db: Executor = getDbPool(),
): Promise<RegisteredAssetKey[]> => {
    try {
        const [rows] = await db.execute<AssetKeyRow[]>(
            `SELECT series_key, episode_key, delivery FROM media_assets
             WHERE status NOT IN ('deleted', 'delete_failed')`,
        );
        return rows.map((row) => ({
            seriesKey: row.series_key,
            episodeKey: row.episode_key,
            delivery: row.delivery === "file" ? "file" : "hls",
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const registerFileAsset = async (
    seriesKey: string,
    episodeKey: string,
    previewClipKey: string | null,
    sizeBytes: number,
    pool: Pool = getDbPool(),
): Promise<"inserted" | "exists"> => withTransaction(async (connection) => {
        await connection.execute(
            "INSERT IGNORE INTO series_identities (series_key, created_at) VALUES (?, NOW())",
            [seriesKey],
        );

        const [rows] = await connection.execute<FileRegistrationRow[]>(
            `SELECT id, status FROM media_assets
             WHERE series_key = ? AND episode_key = ? LIMIT 1 FOR UPDATE`,
            [seriesKey, episodeKey],
        );
        const current = rows[0];

        if (current) {
            if (current.status !== "deleted" && current.status !== "delete_failed") return "exists";

            await connection.execute("DELETE FROM media_renditions WHERE asset_id = ?", [current.id]);
            await connection.execute(
                `UPDATE media_assets
                 SET status = 'ready', delivery = 'file', operation_id = NULL, storage_prefix = ?,
                     container = 'mp4', duration_seconds = NULL, preview_clip_key = ?,
                     preview_start_seconds = NULL, source_size_bytes = ?, total_size_bytes = ?,
                     error_message = NULL, delete_started_at = NULL, deleted_at = NULL,
                     asset_version = asset_version + 1, updated_at = NOW()
                 WHERE id = ?`,
                [libraryStoragePrefix(seriesKey), previewClipKey, sizeBytes, sizeBytes, current.id],
            );
            return "inserted";
        }

        await connection.execute<ResultSetHeader>(
            `INSERT INTO media_assets
                 (series_key, episode_key, status, delivery, storage_prefix, container,
                  preview_clip_key, source_size_bytes, total_size_bytes)
             VALUES (?, ?, 'ready', 'file', ?, 'mp4', ?, ?, ?)`,
            [seriesKey, episodeKey, libraryStoragePrefix(seriesKey), previewClipKey, sizeBytes, sizeBytes],
        );
        return "inserted";
}, pool);

// Osobno od rejestracji, bo klip moze pojawic sie na dysku pozniej niz odcinek.
// Warunek delivery='file' jest tu zabezpieczeniem, nie optymalizacja: bez niego
// nazwa lokalnego pliku nadpisalaby klucz obiektu B2 w assecie HLS.
export const syncFilePreviewClip = async (
    seriesKey: string,
    episodeKey: string,
    previewClipKey: string | null,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE media_assets SET preview_clip_key = ?
             WHERE series_key = ? AND episode_key = ? AND delivery = 'file'
               AND NOT (preview_clip_key <=> ?)`,
            [previewClipKey, seriesKey, episodeKey, previewClipKey],
        );
        return result.affectedRows === 1;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
