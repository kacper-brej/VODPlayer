import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { EpisodeChapterType } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

export interface ChapterRow {
    episodeKey: string;
    type: EpisodeChapterType;
    startSeconds: number;
    endSeconds: number;
    source: "manual" | "inherited";
}

interface ChapterSqlRow extends RowDataPacket {
    episode_key: string;
    type: EpisodeChapterType;
    start_seconds: number;
    end_seconds: number;
    source: "manual" | "inherited";
}

export const listEpisodeChaptersForEpisodes = async (
    seriesKey: string,
    episodeKeys: string[],
    db: Executor = getDbPool(),
): Promise<ChapterRow[]> => {
    if (episodeKeys.length === 0) return [];

    try {
        const placeholders = episodeKeys.map(() => "?").join(",");
        const [rows] = await db.execute<ChapterSqlRow[]>(
            `SELECT episode_key, type, start_seconds, end_seconds, source
             FROM episode_chapters
             WHERE series_key = ? AND episode_key IN (${placeholders})
             ORDER BY start_seconds ASC, end_seconds ASC`,
            [seriesKey, ...episodeKeys],
        );
        return rows.map((row) => ({
            episodeKey: row.episode_key,
            type: row.type,
            startSeconds: row.start_seconds,
            endSeconds: row.end_seconds,
            source: row.source,
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export type SeriesChapterDefaults = Partial<Record<EpisodeChapterType, { startSeconds: number; endSeconds: number }>>;

interface DefaultSqlRow extends RowDataPacket {
    type: EpisodeChapterType;
    start_seconds: number;
    end_seconds: number;
}

export const listSeriesChapterDefaults = async (
    seriesKey: string,
    db: Executor = getDbPool(),
): Promise<SeriesChapterDefaults> => {
    try {
        const [rows] = await db.execute<DefaultSqlRow[]>(
            "SELECT type, start_seconds, end_seconds FROM series_chapter_defaults WHERE series_key = ?",
            [seriesKey],
        );
        const defaults: SeriesChapterDefaults = {};
        for (const row of rows) {
            defaults[row.type] = { startSeconds: row.start_seconds, endSeconds: row.end_seconds };
        }
        return defaults;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

interface DurationSqlRow extends RowDataPacket {
    episode_key: string;
    duration_seconds: number | null;
}

export const listEpisodeDurations = async (
    seriesKey: string,
    episodeKeys: string[],
    db: Executor = getDbPool(),
): Promise<Record<string, number>> => {
    if (episodeKeys.length === 0) return {};

    try {
        const placeholders = episodeKeys.map(() => "?").join(",");
        const [rows] = await db.execute<DurationSqlRow[]>(
            `SELECT episode_key, duration_seconds
             FROM episodes_metadata
             WHERE series_key = ? AND episode_key IN (${placeholders})`,
            [seriesKey, ...episodeKeys],
        );
        const durations: Record<string, number> = {};
        for (const row of rows) {
            if (row.duration_seconds !== null) durations[row.episode_key] = row.duration_seconds;
        }
        return durations;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertSeriesChapterDefault = async (
    seriesKey: string,
    type: EpisodeChapterType,
    startSeconds: number,
    endSeconds: number,
    connection: PoolConnection,
): Promise<void> => {
    try {
        await connection.execute(
            `INSERT INTO series_chapter_defaults (series_key, type, start_seconds, end_seconds, updated_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                start_seconds = VALUES(start_seconds),
                end_seconds = VALUES(end_seconds),
                updated_at = NOW()`,
            [seriesKey, type, startSeconds, endSeconds],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertEpisodeChapterInherited = async (
    seriesKey: string,
    episodeKey: string,
    type: EpisodeChapterType,
    startSeconds: number,
    endSeconds: number,
    connection: PoolConnection,
): Promise<void> => {
    try {
        await connection.execute(
            `INSERT INTO episode_chapters
                (series_key, episode_key, type, start_seconds, end_seconds, source, updated_at)
             VALUES (?, ?, ?, ?, ?, 'inherited', NOW())
             ON DUPLICATE KEY UPDATE
                start_seconds = IF(source = 'manual', start_seconds, VALUES(start_seconds)),
                end_seconds = IF(source = 'manual', end_seconds, VALUES(end_seconds)),
                source = IF(source = 'manual', source, VALUES(source)),
                updated_at = IF(source = 'manual', updated_at, NOW())`,
            [seriesKey, episodeKey, type, startSeconds, endSeconds],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertEpisodeChapterManual = async (
    seriesKey: string,
    episodeKey: string,
    type: EpisodeChapterType,
    startSeconds: number,
    endSeconds: number,
    connection: PoolConnection,
): Promise<void> => {
    try {
        await connection.execute(
            `INSERT INTO episode_chapters
                (series_key, episode_key, type, start_seconds, end_seconds, source, updated_at)
             VALUES (?, ?, ?, ?, ?, 'manual', NOW())
             ON DUPLICATE KEY UPDATE
                start_seconds = VALUES(start_seconds),
                end_seconds = VALUES(end_seconds),
                source = 'manual',
                updated_at = NOW()`,
            [seriesKey, episodeKey, type, startSeconds, endSeconds],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteEpisodeChapter = async (
    seriesKey: string,
    episodeKey: string,
    type: EpisodeChapterType,
    db: Executor = getDbPool(),
): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            "DELETE FROM episode_chapters WHERE series_key = ? AND episode_key = ? AND type = ?",
            [seriesKey, episodeKey, type],
        );
        return result.affectedRows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
