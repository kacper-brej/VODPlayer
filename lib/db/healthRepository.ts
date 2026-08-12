import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getDbPool } from "./pool";
import { mapDatabaseError } from "./errors";

export interface DbHealth {
    ok: true;
    tookMs: number;
}

interface PingRow extends RowDataPacket {
    ping: number;
}

export const pingDatabase = async (): Promise<DbHealth> => {
    const pool = getDbPool();
    const startedAt = performance.now();

    try {
        await pool.query<PingRow[]>("SELECT 1 AS ping");
    } catch (error) {
        throw mapDatabaseError(error);
    }

    return { ok: true, tookMs: Math.round(performance.now() - startedAt) };
};
