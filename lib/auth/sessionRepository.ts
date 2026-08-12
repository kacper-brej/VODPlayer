import "server-only";
import { randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import { hashToken } from "@/lib/auth/tokenHash";
import type { AuthUser } from "@/lib/core/contracts";

interface SessionUserRow extends RowDataPacket {
    id: number;
    username: string;
    email: string;
    role: "viewer" | "admin";
    onboarded_at: string | null;
}

type Executor = Pick<ReturnType<typeof getDbPool>, "execute">;

const mapSessionDatabaseError = (error: unknown) => mapDatabaseError(
    error,
    (message) => console.error(`sessionRepository: ${message}`),
);

export const createSession = async (userId: number, expiresAt: Date): Promise<string> => {
    const rawToken = randomBytes(32).toString("hex");

    try {
        const pool = getDbPool();
        await pool.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
            hashToken(rawToken),
            userId,
            expiresAt,
        ]);
    } catch (error) {
        throw mapSessionDatabaseError(error);
    }

    return rawToken;
};

export const findSessionUser = async (rawToken: string): Promise<AuthUser | null> => {
    try {
        const pool = getDbPool();
        const [rows] = await pool.execute<SessionUserRow[]>(
            `SELECT u.id, u.username, u.email, u.role, u.onboarded_at
             FROM sessions s
             INNER JOIN users u ON u.id = s.user_id
             WHERE s.id = ?
               AND s.expires_at > CURRENT_TIMESTAMP(6)
               AND (u.sessions_valid_from IS NULL OR s.created_at >= u.sessions_valid_from)
             LIMIT 1`,
            [hashToken(rawToken)],
        );
        const row = rows[0];
        if (!row) return null;
        return { id: row.id, username: row.username, email: row.email, role: row.role, onboardedAt: row.onboarded_at };
    } catch (error) {
        throw mapSessionDatabaseError(error);
    }
};

export const advanceSessionsValidFrom = async (userId: number, db: Executor = getDbPool()): Promise<void> => {
    try {
        await db.execute("UPDATE users SET sessions_valid_from = CURRENT_TIMESTAMP(6) WHERE id = ?", [userId]);
    } catch (error) {
        throw mapSessionDatabaseError(error);
    }
};

export const deleteSession = async (rawToken: string): Promise<void> => {
    try {
        const pool = getDbPool();
        await pool.execute("DELETE FROM sessions WHERE id = ?", [hashToken(rawToken)]);
    } catch (error) {
        throw mapSessionDatabaseError(error);
    }
};

export const deleteAllSessionsForUser = async (userId: number): Promise<void> => {
    try {
        const pool = getDbPool();
        await pool.execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
    } catch (error) {
        throw mapSessionDatabaseError(error);
    }
};

export const deleteExpiredSessions = async (limit = 100): Promise<void> => {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
        throw new Error("Limit cleanupu sesji musi mieścić się w zakresie 1-1000.");
    }
    try {
        const pool = getDbPool();
        await pool.execute("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP(6) LIMIT ?", [limit]);
    } catch (error) {
        throw mapSessionDatabaseError(error);
    }
};
