import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { EpisodeProgress, ResumePoint } from "@/lib/core/contracts";
import { isEpisodeComplete } from "@/lib/progress/watchProgress";

type Executor = Pool | PoolConnection;

export interface ReadyMediaAsset { id: number; version: number; seriesKey: string; episodeKey: string; durationSeconds: number | null }
interface AssetRow extends RowDataPacket { id: number; asset_version: number; series_key: string; episode_key: string; duration_seconds: number | null }

export const findReadyMediaAsset = async (seriesKey: string, episodeKey: string, db: Executor = getDbPool()): Promise<ReadyMediaAsset | null> => {
    try {
        const [rows] = await db.execute<AssetRow[]>(
            `SELECT id, asset_version, series_key, episode_key, duration_seconds FROM media_assets
             WHERE series_key = ? AND episode_key = ? AND status = 'ready' LIMIT 1`,
            [seriesKey, episodeKey],
        );
        const row = rows[0];
        return row ? {
            id: row.id,
            version: Number(row.asset_version),
            seriesKey: row.series_key,
            episodeKey: row.episode_key,
            durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
        } : null;
    } catch (error) { throw mapDatabaseError(error); }
};

interface ProgressRow extends RowDataPacket {
    series_key: string; episode_key: string; position_seconds: number; duration_seconds: number | null; completed: number; updated_at: number;
}
export interface ProgressSnapshot { episodesBySeries: Record<string, Record<string, EpisodeProgress>>; resumes: ResumePoint[] }

export const loadProgressSnapshot = async (profileId: number, seriesKeys?: readonly string[], db: Executor = getDbPool()): Promise<ProgressSnapshot> => {
    if (seriesKeys?.length === 0) return { episodesBySeries: {}, resumes: [] };
    const uniqueKeys = seriesKeys ? [...new Set(seriesKeys)].slice(0, 250) : null;
    const filter = uniqueKeys ? ` AND wp.series_key IN (${uniqueKeys.map(() => "?").join(",")})` : "";
    try {
        const [rows] = await db.execute<ProgressRow[]>(
            `SELECT wp.series_key, wp.episode_key, wp.position_seconds, ma.duration_seconds,
                    wp.completed, UNIX_TIMESTAMP(wp.updated_at) AS updated_at
             FROM watch_progress wp
             INNER JOIN media_assets ma ON ma.id = wp.media_asset_id AND ma.status = 'ready'
             WHERE wp.profile_id = ?${filter}
             ORDER BY wp.updated_at DESC`,
            [profileId, ...(uniqueKeys ?? [])],
        );
        const episodesBySeries: Record<string, Record<string, EpisodeProgress>> = {};
        const newestIncomplete = new Map<string, ResumePoint>();
        for (const row of rows) {
            (episodesBySeries[row.series_key] ??= {})[row.episode_key] = {
                positionSeconds: row.position_seconds,
                durationSeconds: row.duration_seconds,
                completed: row.completed === 1,
                updatedAt: row.updated_at,
            };
            const finished = row.completed === 1
                && (row.duration_seconds === null || isEpisodeComplete(row.position_seconds, row.duration_seconds));

            if (!finished && row.position_seconds > 0 && !newestIncomplete.has(row.series_key)) {
                newestIncomplete.set(row.series_key, {
                    seriesKey: row.series_key,
                    episodeKey: row.episode_key,
                    positionSeconds: row.position_seconds,
                    durationSeconds: row.duration_seconds,
                    updatedAt: row.updated_at,
                });
            }
        }
        return { episodesBySeries, resumes: [...newestIncomplete.values()] };
    } catch (error) { throw mapDatabaseError(error); }
};

export const upsertWatchProgress = async (
    profileId: number, asset: ReadyMediaAsset, position: number, completed: boolean, connection: PoolConnection,
): Promise<boolean> => {
    try {
        await connection.execute(
            `INSERT INTO watch_progress
                (profile_id, media_asset_id, media_asset_version, series_key, episode_key, position_seconds, duration_seconds, completed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE media_asset_id = VALUES(media_asset_id), media_asset_version = VALUES(media_asset_version), position_seconds = VALUES(position_seconds),
                duration_seconds = VALUES(duration_seconds), completed = GREATEST(completed, VALUES(completed)), updated_at = NOW()`,
            [profileId, asset.id, asset.version, asset.seriesKey, asset.episodeKey, position, asset.durationSeconds, completed ? 1 : 0],
        );
        const [rows] = await connection.execute<({ completed: number } & RowDataPacket)[]>(
            `SELECT completed FROM watch_progress
             WHERE profile_id = ? AND series_key = ? AND episode_key = ? LIMIT 1`,
            [profileId, asset.seriesKey, asset.episodeKey],
        );
        return rows[0]?.completed === 1;
    } catch (error) { throw mapDatabaseError(error); }
};

export const resetWatchProgressForRewatch = async (
    profileId: number, seriesKey: string, episodeKey: string, connection: PoolConnection,
): Promise<void> => {
    await connection.execute(
        `UPDATE watch_progress SET position_seconds = 0, completed = 0, last_counted_on = NULL, updated_at = NOW()
         WHERE profile_id = ? AND series_key = ? AND episode_key = ?`,
        [profileId, seriesKey, episodeKey],
    );
};

export const markPlayCountedToday = async (
    profileId: number, seriesKey: string, episodeKey: string, connection: PoolConnection,
): Promise<boolean> => {
    try {
        const [result] = await connection.execute<ResultSetHeader>(
            `UPDATE watch_progress SET last_counted_on = CURDATE()
             WHERE profile_id = ? AND series_key = ? AND episode_key = ?
             AND (last_counted_on IS NULL OR last_counted_on < CURDATE())`,
            [profileId, seriesKey, episodeKey],
        );
        return result.affectedRows > 0;
    } catch (error) { throw mapDatabaseError(error); }
};

export const incrementWeeklyPlayCount = async (seriesKey: string, connection: PoolConnection): Promise<void> => {
    try {
        await connection.execute(
            `INSERT INTO series_play_counts (series_key, period_start, play_count)
             VALUES (?, DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), 1)
             ON DUPLICATE KEY UPDATE play_count = play_count + 1`,
            [seriesKey],
        );
    } catch (error) { throw mapDatabaseError(error); }
};
