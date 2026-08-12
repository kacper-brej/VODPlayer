import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { NotificationItem } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

export const NOTIFICATIONS_LIST_LIMIT = 50;

export const countUnreadNotifications = async (profileId: number, db: Executor = getDbPool()): Promise<number> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT COUNT(*) AS count FROM notifications WHERE profile_id = ? AND read_at IS NULL",
            [profileId],
        );
        return (rows[0]?.count as number) ?? 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

interface NotificationSqlRow extends RowDataPacket {
    id: number;
    series_key: string;
    episode_key: string;
    created_at: number;
}

export const listUnreadNotifications = async (
    profileId: number,
    limit: number = NOTIFICATIONS_LIST_LIMIT,
    db: Executor = getDbPool(),
): Promise<NotificationItem[]> => {
    try {
        const [rows] = await db.execute<NotificationSqlRow[]>(
            `SELECT id, series_key, episode_key, UNIX_TIMESTAMP(created_at) AS created_at
             FROM notifications
             WHERE profile_id = ? AND read_at IS NULL
             ORDER BY created_at DESC
             LIMIT ?`,
            [profileId, limit],
        );
        return rows.map((row) => ({
            id: row.id,
            seriesKey: row.series_key,
            episodeKey: row.episode_key,
            createdAt: row.created_at,
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const markNotificationRead = async (
    id: number,
    profileId: number,
    db: Executor = getDbPool(),
): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            "UPDATE notifications SET read_at = NOW() WHERE id = ? AND profile_id = ? AND read_at IS NULL",
            [id, profileId],
        );
        return result.affectedRows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const markAllNotificationsRead = async (profileId: number, db: Executor = getDbPool()): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            "UPDATE notifications SET read_at = NOW() WHERE profile_id = ? AND read_at IS NULL",
            [profileId],
        );
        return result.affectedRows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
