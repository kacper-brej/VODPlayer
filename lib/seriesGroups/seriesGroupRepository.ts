import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";

type Executor = Pool | PoolConnection;

export interface SeriesGroupSummary {
    id: number;
    baseTitle: string;
    createdAt: number;
}

interface GroupSqlRow extends RowDataPacket {
    id: number;
    base_title: string;
    created_at: number;
}

export const listGroups = async (db: Executor = getDbPool()): Promise<SeriesGroupSummary[]> => {
    try {
        const [rows] = await db.execute<GroupSqlRow[]>(
            "SELECT id, base_title, UNIX_TIMESTAMP(created_at) AS created_at FROM series_groups ORDER BY base_title",
        );
        return rows.map((row) => ({ id: row.id, baseTitle: row.base_title, createdAt: row.created_at }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export interface GroupedSeriesRow {
    seriesKey: string;
    seriesId: number;
    groupId: number;
    seasonNumber: number | null;
}

interface GroupedSeriesSqlRow extends RowDataPacket {
    series_key: string;
    id: number;
    group_id: number;
    season_number: number | null;
}

export const listGroupedSeries = async (db: Executor = getDbPool()): Promise<GroupedSeriesRow[]> => {
    try {
        const [rows] = await db.execute<GroupedSeriesSqlRow[]>(
            `SELECT series_key, id, group_id, season_number
             FROM series_identities
             WHERE group_id IS NOT NULL
             ORDER BY season_number IS NULL, season_number, series_key`,
        );
        return rows.map((row) => ({
            seriesKey: row.series_key,
            seriesId: row.id,
            groupId: row.group_id,
            seasonNumber: row.season_number,
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const insertGroup = async (baseTitle: string, db: Executor = getDbPool()): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            "INSERT INTO series_groups (base_title, created_at) VALUES (?, NOW())",
            [baseTitle],
        );
        return result.insertId;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findGroupIdByBaseTitle = async (baseTitle: string, db: Executor = getDbPool()): Promise<number | null> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT id FROM series_groups WHERE base_title = ? LIMIT 1",
            [baseTitle],
        );
        return rows[0] ? (rows[0].id as number) : null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const groupExistsById = async (groupId: number, db: Executor = getDbPool()): Promise<boolean> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>("SELECT id FROM series_groups WHERE id = ? LIMIT 1", [groupId]);
        return rows.length > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const seriesIdentityExists = async (seriesKey: string, db: Executor = getDbPool()): Promise<boolean> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT series_key FROM series_identities WHERE series_key = ? LIMIT 1",
            [seriesKey],
        );
        return rows.length > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const assignSeriesToGroup = async (
    seriesKey: string,
    groupId: number | null,
    seasonNumber: number | null,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            "UPDATE series_identities SET group_id = ?, season_number = ? WHERE series_key = ?",
            [groupId, seasonNumber, seriesKey],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const releaseSeriesFromGroup = async (groupId: number, connection: PoolConnection): Promise<number> => {
    try {
        const [result] = await connection.execute<ResultSetHeader>(
            "UPDATE series_identities SET group_id = NULL, season_number = NULL WHERE group_id = ?",
            [groupId],
        );
        return result.affectedRows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteGroup = async (groupId: number, connection: PoolConnection): Promise<number> => {
    try {
        const [result] = await connection.execute<ResultSetHeader>(
            "DELETE FROM series_groups WHERE id = ?",
            [groupId],
        );
        return result.affectedRows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
