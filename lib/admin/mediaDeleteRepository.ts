import "server-only";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import { withTransaction } from "@/lib/db/transaction";
import type { MediaAssetStatus } from "@/lib/media/mediaLifecycle";

interface DeleteAssetRow extends RowDataPacket {
    id: number;
    status: MediaAssetStatus;
    storage_prefix: string;
    lease_active: number;
}

export type BeginDeletionResult =
    | { kind: "not_found" }
    | { kind: "deleted"; assetId: number }
    | { kind: "in_progress"; assetId: number }
    | { kind: "claimed"; assetId: number; storagePrefix: string };

export const beginMediaDeletion = async (
    seriesKey: string,
    episodeKey: string,
    pool: Pool = getDbPool(),
): Promise<BeginDeletionResult> => withTransaction(async (connection) => {
    const [rows] = await connection.execute<DeleteAssetRow[]>(
        `SELECT id, status, storage_prefix,
                (delete_started_at IS NOT NULL AND delete_started_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)) AS lease_active
         FROM media_assets
         WHERE series_key = ? AND episode_key = ? AND delivery = 'hls' LIMIT 1 FOR UPDATE`,
        [seriesKey, episodeKey],
    );
    const asset = rows[0];
    if (!asset) return { kind: "not_found" };
    if (asset.status === "deleted") return { kind: "deleted", assetId: asset.id };
    if (asset.status === "deleting" && Boolean(asset.lease_active)) {
        return { kind: "in_progress", assetId: asset.id };
    }

    await connection.execute(
        `UPDATE media_assets SET status = 'deleting', delete_started_at = NOW(), deleted_at = NULL,
         error_message = NULL, asset_version = asset_version + 1, updated_at = NOW() WHERE id = ?`,
        [asset.id],
    );
    return { kind: "claimed", assetId: asset.id, storagePrefix: asset.storage_prefix };
}, pool);

export const finalizeMediaDeletion = async (
    assetId: number,
    pool: Pool = getDbPool(),
): Promise<boolean> => withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
            `UPDATE media_assets SET status = 'deleted', deleted_at = NOW(), error_message = NULL,
             preview_clip_key = NULL, total_size_bytes = NULL, asset_version = asset_version + 1, updated_at = NOW()
             WHERE id = ? AND status = 'deleting'`,
            [assetId],
        );
        if (result.affectedRows > 0) {
            await connection.execute("DELETE FROM media_renditions WHERE asset_id = ?", [assetId]);
        }
        return result.affectedRows > 0;
}, pool);

export const markMediaDeletionFailed = async (
    assetId: number,
    safeError: string,
    db = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            `UPDATE media_assets SET status = 'delete_failed', error_message = ?,
             asset_version = asset_version + 1, updated_at = NOW()
             WHERE id = ? AND status = 'deleting'`,
            [safeError, assetId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
