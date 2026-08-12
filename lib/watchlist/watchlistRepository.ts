import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { WatchlistItem } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

interface WatchlistRow extends RowDataPacket {
    series_key: string;
    added_at: number;
}

export const listWatchlistForProfile = async (profileId: number, db: Executor = getDbPool()): Promise<WatchlistItem[]> => {
    try {
        const [rows] = await db.execute<WatchlistRow[]>(
            "SELECT series_key, UNIX_TIMESTAMP(added_at) AS added_at FROM watchlist WHERE profile_id = ? ORDER BY added_at DESC",
            [profileId],
        );
        return rows.map((row) => ({ seriesKey: row.series_key, addedAt: row.added_at }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertWatchlistItem = async (
    profileId: number,
    seriesKey: string,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            "INSERT INTO watchlist (profile_id, series_key, added_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE added_at = NOW()",
            [profileId, seriesKey],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteWatchlistItem = async (
    profileId: number,
    seriesKey: string,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute("DELETE FROM watchlist WHERE profile_id = ? AND series_key = ?", [profileId, seriesKey]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
