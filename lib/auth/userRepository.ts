import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { AuthUser } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

export interface UserForLogin {
    id: number;
    username: string;
    email: string;
    passwordHash: string;
    emailVerified: boolean;
    role: "viewer" | "admin";
    onboardedAt: string | null;
}

interface UserRow extends RowDataPacket {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    email_verified: number;
    role: "viewer" | "admin";
    onboarded_at: string | null;
}

interface PublicUserRow extends RowDataPacket {
    id: number;
    username: string;
    email: string;
    role: "viewer" | "admin";
    onboarded_at: string | null;
}

export const findUserForLogin = async (identifier: string): Promise<UserForLogin | null> => {
    try {
        const pool = getDbPool();
        const [rows] = await pool.execute<UserRow[]>(
            `SELECT id, username, email, password_hash, email_verified, role, onboarded_at
             FROM users WHERE email = ? OR username = ? LIMIT 1`,
            [identifier, identifier],
        );
        const row = rows[0];
        if (!row) return null;

        return {
            id: row.id,
            username: row.username,
            email: row.email,
            passwordHash: row.password_hash,
            emailVerified: row.email_verified === 1,
            role: row.role,
            onboardedAt: row.onboarded_at,
        };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findUserById = async (id: number): Promise<AuthUser | null> => {
    try {
        const pool = getDbPool();
        const [rows] = await pool.execute<PublicUserRow[]>(
            "SELECT id, username, email, role, onboarded_at FROM users WHERE id = ? LIMIT 1",
            [id],
        );
        const row = rows[0];
        if (!row) return null;

        return { id: row.id, username: row.username, email: row.email, role: row.role, onboardedAt: row.onboarded_at };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const markUserOnboarded = async (userId: number, db: Executor = getDbPool()): Promise<void> => {
    try {
        await db.execute("UPDATE users SET onboarded_at = NOW() WHERE id = ? AND onboarded_at IS NULL", [userId]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
