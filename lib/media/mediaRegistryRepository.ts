import "server-only";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import { withTransaction } from "@/lib/db/transaction";
import type { CompleteRegistration, StartRegistration } from "@/lib/media/mediaRegistryService";
import type { MediaAssetStatus } from "@/lib/media/mediaLifecycle";

type Executor = Pool | PoolConnection;

interface AssetStateRow extends RowDataPacket {
    id: number;
    status: MediaAssetStatus;
    storage_prefix: string;
    operation_id: string | null;
}

export type RegistryResult = {
    assetId: number | null;
    status: "processing" | "ready" | "failed" | "already_ready" | "missing" | "conflict";
};

export const registerStart = async (input: StartRegistration): Promise<RegistryResult> =>
    withTransaction(async (connection) => {
        await connection.execute(
            "INSERT IGNORE INTO series_identities (series_key, created_at) VALUES (?, NOW())",
            [input.seriesKey],
        );
        const [rows] = await connection.execute<AssetStateRow[]>(
            `SELECT id, status, storage_prefix, operation_id FROM media_assets
             WHERE series_key = ? AND episode_key = ? LIMIT 1 FOR UPDATE`,
            [input.seriesKey, input.episodeKey],
        );
        const current = rows[0];

        if (!current) {
            const [result] = await connection.execute<ResultSetHeader>(
                `INSERT INTO media_assets
                    (series_key, episode_key, status, operation_id, storage_prefix, duration_seconds, source_size_bytes,
                     preview_start_seconds, error_message, asset_version, created_at, updated_at)
                 VALUES (?, ?, 'processing', ?, ?, ?, ?, ?, NULL, 1, NOW(), NOW())`,
                [input.seriesKey, input.episodeKey, input.operationId, input.storagePrefix, input.durationSeconds,
                    input.sourceSizeBytes, input.previewStartSeconds],
            );
            return { assetId: result.insertId, status: "processing" };
        }

        if (current.status === "deleting" || current.status === "delete_failed") {
            return { assetId: current.id, status: "conflict" };
        }
        if (current.status === "ready" && current.operation_id === input.operationId) {
            return { assetId: current.id, status: "already_ready" };
        }
        if (current.status === "processing" && current.operation_id !== null && current.operation_id !== input.operationId) {
            return { assetId: current.id, status: "conflict" };
        }

        await connection.execute(
            `UPDATE media_assets
             SET status = 'processing', operation_id = ?, storage_prefix = ?, duration_seconds = ?, source_size_bytes = ?,
                 preview_start_seconds = ?, preview_clip_key = NULL, total_size_bytes = NULL,
                 error_message = NULL, delete_started_at = NULL, deleted_at = NULL,
                 asset_version = asset_version + IF(status IN ('ready', 'failed', 'deleted'), 1, 0), updated_at = NOW()
             WHERE id = ?`,
            [input.operationId, input.storagePrefix, input.durationSeconds, input.sourceSizeBytes,
                input.previewStartSeconds, current.id],
        );
        return { assetId: current.id, status: "processing" };
    });

export const registerComplete = async (input: CompleteRegistration): Promise<RegistryResult> =>
    withTransaction(async (connection) => {
        const [rows] = await connection.execute<AssetStateRow[]>(
            `SELECT id, status, storage_prefix, operation_id FROM media_assets
             WHERE series_key = ? AND episode_key = ? LIMIT 1 FOR UPDATE`,
            [input.seriesKey, input.episodeKey],
        );
        const current = rows[0];
        if (!current) return { assetId: null, status: "missing" };
        if (current.operation_id !== input.operationId) return { assetId: current.id, status: "conflict" };
        if (current.status === "deleting" || current.status === "delete_failed" || current.status === "deleted") {
            return { assetId: current.id, status: "conflict" };
        }
        if (current.status === "ready") {
            return { assetId: current.id, status: "already_ready" };
        }

        await connection.execute("DELETE FROM media_renditions WHERE asset_id = ?", [current.id]);
        for (const rendition of input.renditions) {
            await connection.execute(
                `INSERT INTO media_renditions
                    (asset_id, height, width, bitrate_kbps, playlist_key, segment_count, size_bytes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [current.id, rendition.height, rendition.width, rendition.bitrateKbps,
                    rendition.playlistKey, rendition.segmentCount, rendition.sizeBytes],
            );
        }
        await connection.execute(
            `UPDATE media_assets
             SET status = 'ready', total_size_bytes = ?, preview_clip_key = ?, error_message = NULL,
                 asset_version = asset_version + 1, updated_at = NOW()
             WHERE id = ?`,
            [input.totalSizeBytes, input.previewClipKey, current.id],
        );
        await connection.execute(
            `INSERT IGNORE INTO notifications (profile_id, series_key, episode_key, created_at)
             SELECT profile_id, series_key, ?, NOW()
             FROM watchlist
             WHERE series_key = ?`,
            [input.episodeKey, input.seriesKey],
        );
        await connection.execute(
            "DELETE FROM notifications WHERE created_at < NOW() - INTERVAL 30 DAY",
        );
        return { assetId: current.id, status: "ready" };
    });

export const registerFailed = async (
    seriesKey: string,
    episodeKey: string,
    operationId: string,
    errorMessage: string,
): Promise<RegistryResult> => withTransaction(async (connection) => {
    const [rows] = await connection.execute<AssetStateRow[]>(
        `SELECT id, status, storage_prefix, operation_id FROM media_assets
         WHERE series_key = ? AND episode_key = ? LIMIT 1 FOR UPDATE`,
        [seriesKey, episodeKey],
    );
    const current = rows[0];
    if (!current) return { assetId: null, status: "missing" };
    if (current.operation_id !== operationId) return { assetId: current.id, status: "conflict" };
    if (current.status === "ready") return { assetId: current.id, status: "already_ready" };
    if (current.status === "deleting" || current.status === "delete_failed" || current.status === "deleted") {
        return { assetId: current.id, status: "conflict" };
    }

    await connection.execute(
        `UPDATE media_assets SET status = 'failed', error_message = ?,
         asset_version = asset_version + IF(status = 'failed', 0, 1), updated_at = NOW() WHERE id = ?`,
        [errorMessage, current.id],
    );
    return { assetId: current.id, status: "failed" };
});

export const insertVerificationRun = async (
    checkedCount: number,
    failedCount: number,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            "INSERT INTO verification_runs (ran_at, checked_count, failed_count) VALUES (NOW(), ?, ?)",
            [checkedCount, failedCount],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
