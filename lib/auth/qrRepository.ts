import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";

type Executor = Pool | PoolConnection;

export type QrPurpose = "login" | "register";
export type QrStatus = "pending" | "awaiting_verification" | "approved" | "expired";

interface QrSessionRow extends RowDataPacket {
    id: number;
    purpose: QrPurpose;
    status: QrStatus;
    user_id: number | null;
    expires_at: Date;
}

export interface QrSession {
    id: number;
    purpose: QrPurpose;
    status: QrStatus;
    userId: number | null;
    expiresAt: Date;
}

export const insertQrSession = async (
    purpose: QrPurpose,
    tokenHash: string,
    expiresAt: Date,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            "INSERT INTO qr_sessions (session_token, purpose, status, created_at, expires_at) VALUES (?, ?, 'pending', NOW(), ?)",
            [tokenHash, purpose, expiresAt],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteExpiredQrSessions = async (db: Executor = getDbPool(), limit = 20): Promise<void> => {
    try {
        await db.execute("DELETE FROM qr_sessions WHERE expires_at < NOW() LIMIT ?", [limit]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const lockQrSessionByTokenHash = async (
    tokenHash: string,
    connection: PoolConnection,
): Promise<QrSession | null> => {
    try {
        const [rows] = await connection.execute<QrSessionRow[]>(
            "SELECT id, purpose, status, user_id, expires_at FROM qr_sessions WHERE session_token = ? FOR UPDATE",
            [tokenHash],
        );
        const row = rows[0];
        if (!row) return null;

        return { id: row.id, purpose: row.purpose, status: row.status, userId: row.user_id, expiresAt: row.expires_at };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteQrSessionById = async (id: number, connection: PoolConnection): Promise<void> => {
    try {
        await connection.execute("DELETE FROM qr_sessions WHERE id = ?", [id]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const markQrSessionApproved = async (
    tokenHash: string,
    userId: number,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE qr_sessions SET status = 'approved', user_id = ?
             WHERE session_token = ? AND purpose = 'login' AND status = 'pending' AND expires_at > NOW()`,
            [userId, tokenHash],
        );
        return result.affectedRows === 1;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
