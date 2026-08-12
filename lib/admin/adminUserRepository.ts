import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { AdminUserRow } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

interface UserSqlRow extends RowDataPacket {
    id: number;
    username: string;
    email: string;
    email_verified: number;
    role: "viewer" | "admin";
    created_at: number;
}

export const listUsers = async (db: Executor = getDbPool()): Promise<AdminUserRow[]> => {
    try {
        const [rows] = await db.execute<UserSqlRow[]>(
            `SELECT id, username, email, email_verified, role, UNIX_TIMESTAMP(created_at) AS created_at
             FROM users
             ORDER BY created_at DESC`,
        );
        return rows.map((row) => ({
            id: row.id,
            username: row.username,
            email: row.email,
            emailVerified: row.email_verified === 1,
            role: row.role,
            createdAt: row.created_at,
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
