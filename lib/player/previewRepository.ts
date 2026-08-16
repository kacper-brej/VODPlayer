import "server-only";

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";

type Executor = Pool | PoolConnection;

export interface PreviewRendition {
    height: number;
    playlistKey: string;
}

export interface PreviewProgressRecord {
    assetVersion: number | null;
    positionSeconds: number;
    durationSeconds: number;
    completed: boolean;
}

export interface PreviewAsset {
    id: number;
    version: number;
    seriesKey: string;
    episodeKey: string;
    delivery: "hls" | "file";
    durationSeconds: number;
    previewStartSeconds: number | null;
    previewClipKey: string | null;
    renditions: PreviewRendition[];
    progress: PreviewProgressRecord | null;
}

interface PreviewAssetRow extends RowDataPacket {
    asset_id: number;
    asset_version: number;
    series_key: string;
    episode_key: string;
    delivery: "hls" | "file";
    duration_seconds: number | null;
    preview_start_seconds: number | null;
    preview_clip_key: string | null;
    height: number | null;
    playlist_key: string | null;
    progress_asset_version: number | null;
    position_seconds: number | null;
    progress_duration_seconds: number | null;
    completed: number | null;
}

const mapAsset = (rows: PreviewAssetRow[], includeProgress: boolean): PreviewAsset | null => {
    const first = rows[0];
    if (!first) return null;
    return {
        id: Number(first.asset_id),
        version: Number(first.asset_version),
        seriesKey: first.series_key,
        episodeKey: first.episode_key,
        delivery: first.delivery === "file" ? "file" : "hls",
        durationSeconds: first.duration_seconds === null ? 0 : Number(first.duration_seconds),
        previewStartSeconds: first.preview_start_seconds === null ? null : Number(first.preview_start_seconds),
        previewClipKey: first.preview_clip_key,
        renditions: rows
            .filter((row) => row.height !== null && row.playlist_key !== null)
            .map((row) => ({ height: Number(row.height), playlistKey: String(row.playlist_key) })),
        progress: includeProgress && first.position_seconds !== null && first.progress_duration_seconds !== null
            ? {
                assetVersion: first.progress_asset_version === null ? null : Number(first.progress_asset_version),
                positionSeconds: Number(first.position_seconds),
                durationSeconds: Number(first.progress_duration_seconds),
                completed: first.completed === 1,
            }
            : null,
    };
};

export const findPreviewSessionAsset = async (
    profileId: number,
    seriesKey: string,
    episodeKey: string,
    progressKeys: { seriesKey: string; episodeKey: string } = { seriesKey, episodeKey },
    db: Executor = getDbPool(),
): Promise<PreviewAsset | null> => {
    try {
        const [rows] = await db.execute<PreviewAssetRow[]>(
            `SELECT a.id AS asset_id, a.asset_version, a.series_key, a.episode_key,
                    a.delivery, a.duration_seconds, a.preview_start_seconds, a.preview_clip_key,
                    r.height, r.playlist_key,
                    wp.media_asset_version AS progress_asset_version,
                    wp.position_seconds, wp.duration_seconds AS progress_duration_seconds, wp.completed
             FROM media_assets a
             LEFT JOIN media_renditions r ON r.asset_id = a.id
             LEFT JOIN watch_progress wp
               ON wp.profile_id = ? AND wp.series_key = ? AND wp.episode_key = ?
             WHERE a.series_key = ? AND a.episode_key = ? AND a.status = 'ready'
               AND (a.delivery = 'file' OR a.duration_seconds IS NOT NULL)
             ORDER BY r.height ASC`,
            [profileId, progressKeys.seriesKey, progressKeys.episodeKey, seriesKey, episodeKey],
        );
        return mapAsset(rows, true);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findGrantedPreviewAsset = async (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    db: Executor = getDbPool(),
): Promise<PreviewAsset | null> => {
    try {
        const [rows] = await db.execute<PreviewAssetRow[]>(
            `SELECT a.id AS asset_id, a.asset_version, a.series_key, a.episode_key,
                    a.delivery, a.duration_seconds, a.preview_start_seconds, a.preview_clip_key,
                    r.height, r.playlist_key,
                    NULL AS progress_asset_version, NULL AS position_seconds,
                    NULL AS progress_duration_seconds, NULL AS completed
             FROM media_assets a
             LEFT JOIN media_renditions r ON r.asset_id = a.id
             WHERE a.id = ? AND a.asset_version = ? AND a.series_key = ? AND a.episode_key = ?
               AND a.status = 'ready' AND (a.delivery = 'file' OR a.duration_seconds IS NOT NULL)
             ORDER BY r.height ASC`,
            [assetId, assetVersion, seriesKey, episodeKey],
        );
        return mapAsset(rows, false);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
