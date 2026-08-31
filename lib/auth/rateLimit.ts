
import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import { createHash } from "node:crypto";

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 900;

interface CountRow extends RowDataPacket {
    count: number;
}

export const deleteOldAuthAttempts = async (limit = 500): Promise<void> => {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
        throw new Error("Limit czyszczenia auth_attempts musi mieścić się w zakresie 1-10000.");
    }
    try {
        await getDbPool().execute(
            `DELETE FROM auth_attempts WHERE created_at < NOW() - INTERVAL ${WINDOW_SECONDS} SECOND LIMIT ?`,
            [limit],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const clearLoginIdentifierAttempts = async (identifier: string): Promise<void> => {
    if (!identifier) return;
    try {
        await getDbPool().execute("DELETE FROM auth_attempts WHERE email = ?", [identifier]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const consumeLoginRateLimit = async (ip: string, email: string): Promise<boolean> => {
    const connection = await getDbPool().getConnection();
    const scopes = [ip, email].filter(Boolean).map((value) =>
        `auth:${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 48)}`,
    ).sort();
    const acquired: string[] = [];
    try {
        for (const scope of scopes) {
            const [rows] = await connection.execute<({ acquired: number } & RowDataPacket)[]>("SELECT GET_LOCK(?, 2) AS acquired", [scope]);
            if (rows[0]?.acquired !== 1) return true;
            acquired.push(scope);
        }
        const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000);
        const count = async (column: "ip_address" | "email", value: string): Promise<number> => {
            const [rows] = await connection.execute<CountRow[]>(
                `SELECT COUNT(*) AS count FROM auth_attempts WHERE ${column} = ? AND created_at >= ?`,
                [value, windowStart],
            );
            return rows[0]?.count ?? 0;
        };
        if (await count("ip_address", ip) >= MAX_ATTEMPTS || (email && await count("email", email) >= MAX_ATTEMPTS)) return true;
        await connection.execute("INSERT INTO auth_attempts (ip_address, email) VALUES (?, ?)", [ip, email || null]);
        return false;
    } catch (error) {
        throw mapDatabaseError(error);
    } finally {
        for (const scope of acquired.reverse()) await connection.execute("SELECT RELEASE_LOCK(?)", [scope]).catch(() => undefined);
        connection.release();
    }
};
