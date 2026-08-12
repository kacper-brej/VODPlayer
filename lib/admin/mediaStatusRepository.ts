import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { MediaStatusAsset, MediaStatusRendition, MediaStatusLastVerification } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

interface AssetSqlRow extends RowDataPacket {
    id: number;
    series_key: string;
    episode_key: string;
    status: string;
    duration_seconds: number | null;
    total_size_bytes: number | null;
    preview_clip_key: string | null;
    error_message: string | null;
    updated_at: string;
}

interface RenditionSqlRow extends RowDataPacket {
    asset_id: number;
    height: number;
    width: number | null;
    bitrate_kbps: number;
    playlist_key: string;
    segment_count: number | null;
    size_bytes: number | null;
}

export const listMediaAssetsWithRenditions = async (db: Executor = getDbPool()): Promise<MediaStatusAsset[]> => {
    try {
        const [assetRows] = await db.execute<AssetSqlRow[]>(
            `SELECT id, series_key, episode_key, status, duration_seconds, total_size_bytes,
                    preview_clip_key, error_message, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
             FROM media_assets
             ORDER BY series_key, episode_key`,
        );
        const [renditionRows] = await db.execute<RenditionSqlRow[]>(
            `SELECT asset_id, height, width, bitrate_kbps, playlist_key, segment_count, size_bytes
             FROM media_renditions
             ORDER BY asset_id, height`,
        );

        const renditionsByAsset = new Map<number, MediaStatusRendition[]>();
        for (const row of renditionRows) {
            const rendition: MediaStatusRendition = {
                height: row.height,
                width: row.width,
                bitrateKbps: row.bitrate_kbps,
                playlistKey: row.playlist_key,
                segmentCount: row.segment_count,
                sizeBytes: row.size_bytes,
            };
            const bucket = renditionsByAsset.get(row.asset_id);
            if (bucket) bucket.push(rendition);
            else renditionsByAsset.set(row.asset_id, [rendition]);
        }

        return assetRows.map((row) => ({
            seriesKey: row.series_key,
            episodeKey: row.episode_key,
            status: row.status,
            durationSeconds: row.duration_seconds,
            totalSizeBytes: row.total_size_bytes,
            previewClipKey: row.preview_clip_key,
            errorMessage: row.error_message,
            updatedAt: row.updated_at,
            renditions: renditionsByAsset.get(row.id) ?? [],
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

interface VerificationRunSqlRow extends RowDataPacket {
    ran_at: string;
    checked_count: number;
    failed_count: number;
}

export const getLastVerificationRun = async (db: Executor = getDbPool()): Promise<MediaStatusLastVerification | null> => {
    try {
        const [rows] = await db.execute<VerificationRunSqlRow[]>(
            `SELECT DATE_FORMAT(ran_at, '%Y-%m-%d %H:%i:%s') AS ran_at, checked_count, failed_count
             FROM verification_runs
             ORDER BY ran_at DESC
             LIMIT 1`,
        );
        const row = rows[0];
        return row ? { ranAt: row.ran_at, checkedCount: row.checked_count, failedCount: row.failed_count } : null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
