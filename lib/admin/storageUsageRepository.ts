import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { StorageUsageSnapshot } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

export const sumReadyMediaAssetBytes = async (db: Executor = getDbPool()): Promise<number> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT COALESCE(SUM(total_size_bytes), 0) AS total_bytes FROM media_assets WHERE status = 'ready'",
        );
        return Number(rows[0]?.total_bytes ?? 0);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const getCurrentDate = async (db: Executor = getDbPool()): Promise<string> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
        return rows[0]?.today as string;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertSnapshot = async (date: string, totalBytes: number, db: Executor = getDbPool()): Promise<void> => {
    try {
        await db.execute(
            `INSERT INTO storage_usage_snapshots (captured_at, total_bytes)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE total_bytes = VALUES(total_bytes)`,
            [date, totalBytes],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

interface SnapshotSqlRow extends RowDataPacket {
    date: string;
    total_bytes: number;
}

export const listSnapshotsSince90Days = async (
    referenceDate: string,
    db: Executor = getDbPool(),
): Promise<StorageUsageSnapshot[]> => {
    try {
        const [rows] = await db.execute<SnapshotSqlRow[]>(
            `SELECT DATE_FORMAT(captured_at, '%Y-%m-%d') AS date, total_bytes
             FROM storage_usage_snapshots
             WHERE captured_at >= DATE_SUB(?, INTERVAL 90 DAY)
             ORDER BY captured_at ASC`,
            [referenceDate],
        );
        return rows.map((row) => ({ date: row.date, totalBytes: Number(row.total_bytes) }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
