import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";

type Executor = Pool | PoolConnection;

export interface CachedResponseRow {
    responseJson: string;
    ageSeconds: number;
}

interface CacheSqlRow extends RowDataPacket {
    response_json: string;
    age_seconds: number;
}

export const getCachedResponse = async (
    provider: string,
    cacheKey: string,
    db: Executor = getDbPool(),
): Promise<CachedResponseRow | null> => {
    try {
        const [rows] = await db.execute<CacheSqlRow[]>(
            `SELECT response_json, TIMESTAMPDIFF(SECOND, fetched_at, UTC_TIMESTAMP()) AS age_seconds
             FROM provider_response_cache
             WHERE provider = ? AND cache_key = ?
             LIMIT 1`,
            [provider, cacheKey],
        );
        const row = rows[0];
        return row ? { responseJson: row.response_json, ageSeconds: row.age_seconds } : null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertCachedResponse = async (
    provider: string,
    cacheKey: string,
    requestPath: string,
    responseJson: string,
    fetchedAtMs = Date.now(),
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            `INSERT INTO provider_response_cache (provider, cache_key, request_path, response_json, fetched_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                request_path = IF(VALUES(fetched_at) > fetched_at, VALUES(request_path), request_path),
                response_json = IF(VALUES(fetched_at) > fetched_at, VALUES(response_json), response_json),
                fetched_at = GREATEST(fetched_at, VALUES(fetched_at))`,
            [provider, cacheKey, requestPath, responseJson, new Date(fetchedAtMs).toISOString().slice(0, 19).replace("T", " ")],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
