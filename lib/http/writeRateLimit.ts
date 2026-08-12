//Returns true once the limit is exceeded. A missing row counts as exceeded too (fail closed), since it means the counter write never landed.
import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";

interface RateRow extends RowDataPacket { request_count: number }

const STALE_WINDOW_SECONDS = 86_400;

export const deleteStaleWriteRateLimits = async (limit = 500): Promise<void> => {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
        throw new Error("Limit czyszczenia request_rate_limits musi mieścić się w zakresie 1-10000.");
    }
    try {
        await getDbPool().execute(
            `DELETE FROM request_rate_limits
             WHERE window_started_at < CURRENT_TIMESTAMP(6) - INTERVAL ${STALE_WINDOW_SECONDS} SECOND LIMIT ?`,
            [limit],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const consumeWriteRateLimit = async (
    userId: number,
    category: string,
    maximum: number,
    windowSeconds: number,
): Promise<boolean> => {
    const safeMaximum = Math.max(1, Math.min(10_000, Math.trunc(maximum)));
    const safeWindow = Math.max(1, Math.min(86_400, Math.trunc(windowSeconds)));
    const scope = `user:${userId}:${category}`.slice(0, 191);
    const pool = getDbPool();
    await pool.execute(
        `INSERT INTO request_rate_limits (scope_key, window_started_at, request_count)
         VALUES (?, CURRENT_TIMESTAMP(6), 1)
         ON DUPLICATE KEY UPDATE
            request_count = IF(window_started_at < CURRENT_TIMESTAMP(6) - INTERVAL ${safeWindow} SECOND, 1, request_count + 1),
            window_started_at = IF(window_started_at < CURRENT_TIMESTAMP(6) - INTERVAL ${safeWindow} SECOND, CURRENT_TIMESTAMP(6), window_started_at)`,
        [scope],
    );
    const [rows] = await pool.execute<RateRow[]>("SELECT request_count FROM request_rate_limits WHERE scope_key = ?", [scope]);
    return (rows[0]?.request_count ?? safeMaximum + 1) > safeMaximum;
};
