import "server-only";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { SeriesAccessGrantRow, SeriesVisibility } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

interface VisibilityRow extends RowDataPacket {
    series_key: string;
    visibility: SeriesVisibility;
}

interface SeriesKeyRow extends RowDataPacket {
    series_key: string;
}

interface UserIdRow extends RowDataPacket {
    user_id: number;
}

interface GrantRow extends RowDataPacket {
    series_key: string;
    user_id: number;
    granted_at: number;
}

export const loadVisibilityMap = async (db: Executor = getDbPool()): Promise<Map<string, SeriesVisibility>> => {
    try {
        const [rows] = await db.execute<VisibilityRow[]>("SELECT series_key, visibility FROM series_access");
        return new Map(rows.map((row) => [row.series_key, row.visibility]));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findSeriesVisibility = async (
    seriesKey: string,
    db: Executor = getDbPool(),
): Promise<SeriesVisibility | null> => {
    try {
        const [rows] = await db.execute<VisibilityRow[]>(
            "SELECT series_key, visibility FROM series_access WHERE series_key = ? LIMIT 1",
            [seriesKey],
        );
        return rows[0]?.visibility ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const loadUserGrants = async (userId: number, db: Executor = getDbPool()): Promise<string[]> => {
    try {
        const [rows] = await db.execute<SeriesKeyRow[]>(
            "SELECT series_key FROM series_access_grants WHERE user_id = ?",
            [userId],
        );
        return rows.map((row) => row.series_key);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const listGrantedUserIds = async (
    seriesKey: string,
    db: Executor = getDbPool(),
): Promise<number[]> => {
    try {
        const [rows] = await db.execute<UserIdRow[]>(
            "SELECT user_id FROM series_access_grants WHERE series_key = ? ORDER BY user_id",
            [seriesKey],
        );
        return rows.map((row) => Number(row.user_id));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const listAllGrants = async (db: Executor = getDbPool()): Promise<SeriesAccessGrantRow[]> => {
    try {
        const [rows] = await db.execute<GrantRow[]>(
            `SELECT series_key, user_id, UNIX_TIMESTAMP(granted_at) AS granted_at
             FROM series_access_grants ORDER BY series_key, user_id`,
        );
        return rows.map((row) => ({
            seriesKey: row.series_key,
            userId: Number(row.user_id),
            grantedAt: Number(row.granted_at),
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteDemoProgressForUser = async (
    userId: number,
    seriesKey: string,
    demoAssetId: number,
    db: Executor = getDbPool(),
): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `DELETE wp FROM watch_progress wp
             INNER JOIN profiles p ON p.id = wp.profile_id
             WHERE p.user_id = ? AND wp.series_key = ? AND wp.media_asset_id = ?`,
            [userId, seriesKey, demoAssetId],
        );
        return result.affectedRows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const setSeriesVisibility = async (
    seriesKey: string,
    visibility: SeriesVisibility,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            `INSERT INTO series_access (series_key, visibility) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE visibility = VALUES(visibility)`,
            [seriesKey, visibility],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const grantSeriesAccess = async (
    seriesKey: string,
    userId: number,
    grantedBy: number | null,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            `INSERT INTO series_access_grants (series_key, user_id, granted_by) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by), granted_at = NOW()`,
            [seriesKey, userId, grantedBy],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const revokeSeriesAccess = async (
    seriesKey: string,
    userId: number,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            "DELETE FROM series_access_grants WHERE series_key = ? AND user_id = ?",
            [seriesKey, userId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
