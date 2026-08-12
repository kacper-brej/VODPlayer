import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import { hashToken } from "@/lib/auth/tokenHash";

type Executor = Pool | PoolConnection;

interface IdRow extends RowDataPacket {
    id: number;
}

interface PendingEmailRow extends RowDataPacket {
    id: number;
    pending_email: string | null;
}

export const findUserIdByEmailOrUsername = async (
    email: string,
    username: string,
    db: Executor = getDbPool(),
): Promise<number | null> => {
    try {
        const [rows] = await db.execute<IdRow[]>(
            "SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1",
            [email, username],
        );
        return rows[0]?.id ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const insertUser = async (
    username: string,
    email: string,
    passwordHash: string,
    verificationTokenHash: string,
    verificationExpiresAt: Date,
    db: Executor = getDbPool(),
): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `INSERT INTO users (username, email, password_hash, verification_token, verification_token_expires, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [username, email, passwordHash, verificationTokenHash, verificationExpiresAt],
        );
        return result.insertId;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const lockPendingQrRegisterSession = async (
    qrToken: string,
    connection: PoolConnection,
): Promise<number | null> => {
    try {
        const [rows] = await connection.execute<IdRow[]>(
            `SELECT id FROM qr_sessions
             WHERE session_token = ? AND purpose = 'register' AND status = 'pending' AND expires_at > NOW()
             FOR UPDATE`,
            [hashToken(qrToken)],
        );
        return rows[0]?.id ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const linkQrSessionToUser = async (
    qrSessionId: number,
    userId: number,
    connection: PoolConnection,
): Promise<void> => {
    try {
        await connection.execute(
            "UPDATE qr_sessions SET user_id = ?, status = 'awaiting_verification' WHERE id = ?",
            [userId, qrSessionId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const lockUserByVerificationTokenHash = async (
    tokenHash: string,
    connection: PoolConnection,
): Promise<number | null> => {
    try {
        const [rows] = await connection.execute<IdRow[]>(
            "SELECT id FROM users WHERE verification_token = ? AND verification_token_expires > NOW() FOR UPDATE",
            [tokenHash],
        );
        return rows[0]?.id ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const markEmailVerified = async (userId: number, connection: PoolConnection): Promise<void> => {
    try {
        await connection.execute(
            "UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?",
            [userId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const approvePendingQrRegisterSession = async (userId: number, connection: PoolConnection): Promise<void> => {
    try {
        await connection.execute(
            `UPDATE qr_sessions SET status = 'approved'
             WHERE user_id = ? AND purpose = 'register' AND status = 'awaiting_verification' AND expires_at > NOW()`,
            [userId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findUnverifiedUserIdByEmail = async (email: string, db: Executor = getDbPool()): Promise<number | null> => {
    try {
        const [rows] = await db.execute<IdRow[]>(
            "SELECT id FROM users WHERE email = ? AND email_verified = 0 LIMIT 1",
            [email],
        );
        return rows[0]?.id ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const setVerificationToken = async (
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute("UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?", [
            tokenHash,
            expiresAt,
            userId,
        ]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findUserIdByEmail = async (email: string, db: Executor = getDbPool()): Promise<number | null> => {
    try {
        const [rows] = await db.execute<IdRow[]>("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
        return rows[0]?.id ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const setResetToken = async (
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?", [
            tokenHash,
            expiresAt,
            userId,
        ]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const lockUserByResetTokenHash = async (tokenHash: string, connection: PoolConnection): Promise<number | null> => {
    try {
        const [rows] = await connection.execute<IdRow[]>(
            "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW() FOR UPDATE",
            [tokenHash],
        );
        return rows[0]?.id ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const applyPasswordReset = async (
    userId: number,
    newPasswordHash: string,
    connection: PoolConnection,
): Promise<void> => {
    try {
        await connection.execute(
            `UPDATE users
             SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL,
                 sessions_valid_from = CURRENT_TIMESTAMP(6)
             WHERE id = ?`,
            [newPasswordHash, userId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const isEmailTakenByOther = async (email: string, userId: number, db: Executor = getDbPool()): Promise<boolean> => {
    try {
        const [rows] = await db.execute<IdRow[]>("SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1", [
            email,
            userId,
        ]);
        return rows.length > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const setEmailChangeRequest = async (
    userId: number,
    pendingEmail: string,
    tokenHash: string,
    expiresAt: Date,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            "UPDATE users SET pending_email = ?, email_change_token = ?, email_change_token_expires = ? WHERE id = ?",
            [pendingEmail, tokenHash, expiresAt, userId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const lockUserByEmailChangeTokenHash = async (
    tokenHash: string,
    connection: PoolConnection,
): Promise<{ id: number; pendingEmail: string } | null> => {
    try {
        const [rows] = await connection.execute<PendingEmailRow[]>(
            "SELECT id, pending_email FROM users WHERE email_change_token = ? AND email_change_token_expires > NOW() FOR UPDATE",
            [tokenHash],
        );
        const row = rows[0];
        if (!row || !row.pending_email) return null;
        return { id: row.id, pendingEmail: row.pending_email };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const applyEmailChange = async (userId: number, connection: PoolConnection): Promise<void> => {
    try {
        await connection.execute(
            `UPDATE users
             SET email = pending_email, pending_email = NULL, email_change_token = NULL, email_change_token_expires = NULL,
                 sessions_valid_from = CURRENT_TIMESTAMP(6)
             WHERE id = ?`,
            [userId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
