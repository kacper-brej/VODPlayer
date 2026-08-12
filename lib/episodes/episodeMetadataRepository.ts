import "server-only";

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { DatabaseError, mapDatabaseError } from "@/lib/db/errors";

type Executor = Pool | PoolConnection;

export type ThumbnailSource = "local" | "tmdb";

export interface EpisodeMetadataPatch {
    seriesKey: string;
    episodeKey: string;
    title?: string | null;
    synopsis?: string | null;
    durationSeconds?: number | null;
    thumbnailPath?: string | null;
    thumbnailSource?: ThumbnailSource | null;
}

interface EpisodeMetadataSqlRow extends RowDataPacket {
    episode_key: string;
    title: string | null;
    synopsis: string | null;
    duration_seconds: number | null;
    thumbnail_path: string | null;
    thumbnail_source: ThumbnailSource | null;
}

interface ReadyAssetSqlRow extends RowDataPacket { found: number }

export interface EpisodeMetadataRecord {
    episodeKey: string;
    title: string | null;
    synopsis: string | null;
    durationSeconds: number | null;
    thumbnailPath: string | null;
    thumbnailSource: ThumbnailSource | null;
}

export interface EpisodeBackfillRow extends RowDataPacket {
    series_key: string;
    episode_key: string;
    season_number: number | null;
    title: string | null;
    synopsis: string | null;
    thumbnail_path: string | null;
    thumbnail_source: ThumbnailSource | null;
}

const mapMetadataRow = (row: EpisodeMetadataSqlRow): EpisodeMetadataRecord => ({
    episodeKey: row.episode_key,
    title: row.title,
    synopsis: row.synopsis,
    durationSeconds: row.duration_seconds,
    thumbnailPath: row.thumbnail_path,
    thumbnailSource: row.thumbnail_source,
});

export const findEpisodeMetadata = async (
    seriesKey: string,
    episodeKey: string,
    db: Executor = getDbPool(),
): Promise<EpisodeMetadataRecord | null> => {
    try {
        const [rows] = await db.execute<EpisodeMetadataSqlRow[]>(
            `SELECT episode_key, title, synopsis, duration_seconds, thumbnail_path, thumbnail_source
             FROM episodes_metadata
             WHERE series_key = ? AND episode_key = ?
             LIMIT 1`,
            [seriesKey, episodeKey],
        );
        return rows[0] ? mapMetadataRow(rows[0]) : null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const hasReadyMediaAsset = async (
    seriesKey: string,
    episodeKey: string,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [rows] = await db.execute<ReadyAssetSqlRow[]>(
            `SELECT 1 AS found
             FROM media_assets
             WHERE series_key = ? AND episode_key = ? AND status = 'ready'
             LIMIT 1`,
            [seriesKey, episodeKey],
        );
        return rows.length > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertEpisodeMetadata = async (
    patch: EpisodeMetadataPatch,
    db: Executor = getDbPool(),
): Promise<EpisodeMetadataRecord | null> => {
    try {
        const setTitle = patch.title !== undefined;
        const setSynopsis = patch.synopsis !== undefined;
        const setDuration = patch.durationSeconds !== undefined;
        const setThumbnail = patch.thumbnailPath !== undefined;

        await db.execute(
            `INSERT INTO episodes_metadata
                (series_key, episode_key, title, synopsis, duration_seconds,
                 thumbnail_path, thumbnail_source, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                title = IF(?, VALUES(title), title),
                synopsis = IF(?, VALUES(synopsis), synopsis),
                duration_seconds = IF(?, VALUES(duration_seconds), duration_seconds),
                thumbnail_path = IF(?, VALUES(thumbnail_path), thumbnail_path),
                thumbnail_source = IF(?, VALUES(thumbnail_source), thumbnail_source),
                updated_at = NOW()`,
            [
                patch.seriesKey,
                patch.episodeKey,
                patch.title ?? null,
                patch.synopsis ?? null,
                patch.durationSeconds ?? null,
                patch.thumbnailPath ?? null,
                patch.thumbnailSource ?? null,
                setTitle ? 1 : 0,
                setSynopsis ? 1 : 0,
                setDuration ? 1 : 0,
                setThumbnail ? 1 : 0,
                setThumbnail ? 1 : 0,
            ],
        );

        return findEpisodeMetadata(patch.seriesKey, patch.episodeKey, db);
    } catch (error) {
        if (error instanceof DatabaseError) throw error;
        throw mapDatabaseError(error);
    }
};

export const listReadyEpisodesForBackfill = async (
    db: Executor = getDbPool(),
): Promise<EpisodeBackfillRow[]> => {
    try {
        const [rows] = await db.execute<EpisodeBackfillRow[]>(
            `SELECT a.series_key, a.episode_key, i.season_number, e.title, e.synopsis,
                    e.thumbnail_path, e.thumbnail_source
             FROM media_assets a
             INNER JOIN series_identities i ON i.series_key = a.series_key
             LEFT JOIN episodes_metadata e
               ON e.series_key = a.series_key AND e.episode_key = a.episode_key
             WHERE a.status = 'ready'
             ORDER BY a.series_key, a.episode_key`,
        );
        return rows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
