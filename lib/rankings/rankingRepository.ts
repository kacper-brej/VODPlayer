import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";

type Executor = Pool | PoolConnection;

export interface SeriesPlayCount {
    seriesKey: string;
    playCount: number;
}

interface PlayCountSqlRow extends RowDataPacket {
    series_key: string;
    play_count: number;
}

export const listCurrentWeekPlayCounts = async (db: Executor = getDbPool()): Promise<SeriesPlayCount[]> => {
    try {
        const [rows] = await db.execute<PlayCountSqlRow[]>(
            `SELECT series_key, play_count
             FROM series_play_counts
             WHERE period_start = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
             ORDER BY play_count DESC, series_key ASC`,
        );
        return rows.map((row) => ({ seriesKey: row.series_key, playCount: row.play_count }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
