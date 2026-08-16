import "server-only";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { RegisteredAssetKey } from "@/lib/media/libraryRegistration";
import { libraryStoragePrefix } from "@/lib/media/libraryRegistration";

type Executor = Pool | PoolConnection;

interface AssetKeyRow extends RowDataPacket {
    series_key: string;
    episode_key: string;
    delivery: "hls" | "file";
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

// Idempotentne: powtorne wywolanie dla tego samego odcinka nie tworzy duplikatu
// (blokuje UNIQUE(series_key, episode_key)) i nie podbija asset_version -
// ON DUPLICATE KEY UPDATE id = id jest zapisem pustym.
export const registerFileAsset = async (
    seriesKey: string,
    episodeKey: string,
    previewClipKey: string | null,
    db: Executor = getDbPool(),
): Promise<"inserted" | "exists"> => {
    try {
        await db.execute(
            "INSERT IGNORE INTO series_identities (series_key, created_at) VALUES (?, NOW())",
            [seriesKey],
        );
        const [result] = await db.execute<ResultSetHeader>(
            `INSERT INTO media_assets
                 (series_key, episode_key, status, delivery, storage_prefix, container, preview_clip_key)
             VALUES (?, ?, 'ready', 'file', ?, 'mp4', ?)
             ON DUPLICATE KEY UPDATE id = id`,
            [seriesKey, episodeKey, libraryStoragePrefix(seriesKey), previewClipKey],
        );
        return result.affectedRows === 1 ? "inserted" : "exists";
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

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
