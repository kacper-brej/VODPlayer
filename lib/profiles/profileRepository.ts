import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { Profile } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

interface ProfileRow extends RowDataPacket {
    id: number;
    name: string;
    is_default: number;
    avatar: string | null;
}

interface CountRow extends RowDataPacket {
    count: number;
}

interface DefaultIdRow extends RowDataPacket {
    id: number;
}

export const listProfilesForUser = async (userId: number, db: Executor = getDbPool()): Promise<Profile[]> => {
    try {
        const [rows] = await db.execute<ProfileRow[]>(
            "SELECT id, name, is_default, avatar FROM profiles WHERE user_id = ? ORDER BY is_default DESC, id ASC",
            [userId],
        );
        return rows.map((row) => ({ id: row.id, name: row.name, isDefault: row.is_default === 1, avatar: row.avatar }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const countProfilesForUser = async (userId: number, db: Executor = getDbPool()): Promise<number> => {
    try {
        const [rows] = await db.execute<CountRow[]>("SELECT COUNT(*) AS count FROM profiles WHERE user_id = ?", [userId]);
        return rows[0]?.count ?? 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const isProfileOwnedByUser = async (
    profileId: number,
    userId: number,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [rows] = await db.execute<RowDataPacket[]>(
            "SELECT id FROM profiles WHERE id = ? AND user_id = ? LIMIT 1",
            [profileId, userId],
        );
        return rows.length > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findDefaultProfileId = async (userId: number, db: Executor = getDbPool()): Promise<number | null> => {
    try {
        const [rows] = await db.execute<DefaultIdRow[]>(
            "SELECT id FROM profiles WHERE user_id = ? ORDER BY is_default DESC, id ASC LIMIT 1",
            [userId],
        );
        return rows[0]?.id ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const insertDefaultProfile = async (
    userId: number,
    name: string,
    avatar: string | null = null,
    db: Executor = getDbPool(),
): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            "INSERT INTO profiles (user_id, name, is_default, avatar, created_at) VALUES (?, ?, 1, ?, NOW())",
            [userId, name, avatar],
        );
        return result.insertId;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const insertProfile = async (
    userId: number,
    name: string,
    avatar: string | null = null,
    db: Executor = getDbPool(),
): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            "INSERT INTO profiles (user_id, name, is_default, avatar, created_at) VALUES (?, ?, 0, ?, NOW())",
            [userId, name, avatar],
        );
        return result.insertId;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const renameProfileById = async (profileId: number, name: string, db: Executor = getDbPool()): Promise<void> => {
    try {
        await db.execute("UPDATE profiles SET name = ? WHERE id = ?", [name, profileId]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const updateProfileById = async (
    profileId: number,
    name: string,
    avatar: string | null,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute("UPDATE profiles SET name = ?, avatar = ? WHERE id = ?", [name, avatar, profileId]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const updateProfileAvatarById = async (
    profileId: number,
    avatar: string | null,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute("UPDATE profiles SET avatar = ? WHERE id = ?", [avatar, profileId]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const isProfileDefault = async (profileId: number, connection: PoolConnection): Promise<boolean> => {
    try {
        const [rows] = await connection.execute<RowDataPacket[]>(
            "SELECT is_default FROM profiles WHERE id = ? LIMIT 1",
            [profileId],
        );
        return rows[0]?.is_default === 1;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteProfileById = async (profileId: number, connection: PoolConnection): Promise<void> => {
    try {
        await connection.execute("DELETE FROM profiles WHERE id = ?", [profileId]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const promoteFirstProfileToDefault = async (userId: number, connection: PoolConnection): Promise<void> => {
    try {
        const [rows] = await connection.execute<DefaultIdRow[]>(
            "SELECT id FROM profiles WHERE user_id = ? ORDER BY id ASC LIMIT 1",
            [userId],
        );
        const next = rows[0];
        if (next) {
            await connection.execute("UPDATE profiles SET is_default = 1 WHERE id = ?", [next.id]);
        }
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
