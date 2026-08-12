import "server-only";
import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";

interface LockRow extends RowDataPacket { acquired: number | null }

export class AdminJobAlreadyRunningError extends Error {}

export const withAdminJobLock = async <T>(jobName: string, operation: () => Promise<T>): Promise<T> => {
    const connection = await getDbPool().getConnection();
    const lockName = `nocturna:${createHash("sha256").update(jobName).digest("hex").slice(0, 48)}`;
    try {
        const [rows] = await connection.execute<LockRow[]>("SELECT GET_LOCK(?, 0) AS acquired", [lockName]);
        if (rows[0]?.acquired !== 1) throw new AdminJobAlreadyRunningError();
        return await operation();
    } finally {
        try { await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]); } finally { connection.release(); }
    }
};
