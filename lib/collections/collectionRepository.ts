import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { CollectionSummary } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

interface SummaryRow extends RowDataPacket {
    id: number;
    name: string;
    created_at: number;
    item_count: number;
}

export const listCollectionsForProfile = async (
    profileId: number,
    db: Executor = getDbPool(),
): Promise<CollectionSummary[]> => {
    try {
        const [rows] = await db.execute<SummaryRow[]>(
            `SELECT c.id, c.name, UNIX_TIMESTAMP(c.created_at) AS created_at, COUNT(ci.series_key) AS item_count
             FROM collections c
             LEFT JOIN collection_items ci ON ci.collection_id = c.id
             WHERE c.profile_id = ?
             GROUP BY c.id, c.name, c.created_at
             ORDER BY c.created_at DESC`,
            [profileId],
        );
        return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at, itemCount: row.item_count }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const countCollectionsForProfile = async (profileId: number, db: Executor = getDbPool()): Promise<number> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT COUNT(*) AS count FROM collections WHERE profile_id = ?",
            [profileId],
        );
        return (rows[0]?.count as number) ?? 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const isCollectionOwnedByProfile = async (
    collectionId: number,
    profileId: number,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT id FROM collections WHERE id = ? AND profile_id = ? LIMIT 1",
            [collectionId, profileId],
        );
        return rows.length > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

interface MetaRow extends RowDataPacket {
    name: string;
    created_at: number;
}

export const getCollectionMeta = async (
    collectionId: number,
    db: Executor = getDbPool(),
): Promise<{ name: string; createdAt: number } | null> => {
    try {
        const [rows] = await db.execute<MetaRow[]>(
            "SELECT name, UNIX_TIMESTAMP(created_at) AS created_at FROM collections WHERE id = ? LIMIT 1",
            [collectionId],
        );
        const row = rows[0];
        return row ? { name: row.name, createdAt: row.created_at } : null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

interface SeriesKeyRow extends RowDataPacket {
    series_key: string;
}

export const listCollectionItems = async (collectionId: number, db: Executor = getDbPool()): Promise<string[]> => {
    try {
        const [rows] = await db.execute<SeriesKeyRow[]>(
            "SELECT series_key FROM collection_items WHERE collection_id = ? ORDER BY added_at DESC",
            [collectionId],
        );
        return rows.map((row) => row.series_key);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const insertCollection = async (
    profileId: number,
    name: string,
    db: Executor = getDbPool(),
): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            "INSERT INTO collections (profile_id, name, created_at) VALUES (?, ?, NOW())",
            [profileId, name],
        );
        return result.insertId;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const renameCollectionById = async (
    collectionId: number,
    name: string,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute("UPDATE collections SET name = ? WHERE id = ?", [name, collectionId]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteCollectionItemsByCollectionId = async (collectionId: number, connection: PoolConnection): Promise<void> => {
    try {
        await connection.execute("DELETE FROM collection_items WHERE collection_id = ?", [collectionId]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteCollectionById = async (collectionId: number, connection: PoolConnection): Promise<void> => {
    try {
        await connection.execute("DELETE FROM collections WHERE id = ?", [collectionId]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertCollectionItem = async (
    collectionId: number,
    seriesKey: string,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            "INSERT INTO collection_items (collection_id, series_key, added_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE added_at = NOW()",
            [collectionId, seriesKey],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteCollectionItem = async (
    collectionId: number,
    seriesKey: string,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute("DELETE FROM collection_items WHERE collection_id = ? AND series_key = ?", [collectionId, seriesKey]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
