import "server-only";
import type { Pool, PoolConnection } from "mysql2/promise";
import { withTransaction } from "@/lib/db/transaction";
import { DatabaseError } from "@/lib/db/errors";
import type { Profile } from "@/lib/core/contracts";
import { selectedProfileId } from "@/lib/core/vodConfig";
import { isProfileAvatar, MAX_PROFILES_PER_ACCOUNT, type ProfileAvatar } from "@/lib/core/onboarding";
import * as repo from "@/lib/profiles/profileRepository";

type Executor = Pool | PoolConnection;

export const validateProfileName = (raw: string): string | null => {
    const name = raw.trim();
    if (name === "" || name.length > 50) return null;
    return name;
};

export const ensureDefaultProfile = async (userId: number, username: string, db?: Executor): Promise<number> => {
    const existing = await repo.findDefaultProfileId(userId, db);
    if (existing !== null) return existing;
    return repo.insertDefaultProfile(userId, username, null, db);
};

export const listProfiles = async (userId: number, username: string): Promise<Profile[]> => {
    await ensureDefaultProfile(userId, username);
    return repo.listProfilesForUser(userId);
};

export type CreateProfileResult =
    | { ok: true; profile: Profile }
    | { ok: false; code: "invalid" | "limit" | "conflict" | "server" };

export const createProfile = async (
    userId: number,
    rawName: string,
    avatar: ProfileAvatar | null = null,
): Promise<CreateProfileResult> => {
    const name = validateProfileName(rawName);
    if (name === null) return { ok: false, code: "invalid" };

    try {
        const count = await repo.countProfilesForUser(userId);
        if (count >= MAX_PROFILES_PER_ACCOUNT) return { ok: false, code: "limit" };

        const id = await repo.insertProfile(userId, name, avatar);
        return { ok: true, profile: { id, name, isDefault: false, avatar } };
    } catch (error) {
        if (error instanceof DatabaseError && error.code === "conflict") return { ok: false, code: "conflict" };
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type UpdateProfileResult =
    | { ok: true; profile: { id: number; name: string; avatar: ProfileAvatar | null } }
    | { ok: false; code: "invalid" | "invalid_avatar" | "forbidden" | "conflict" | "server" };

export const updateProfile = async (
    userId: number,
    profileId: number,
    rawName: string,
    avatar: unknown,
): Promise<UpdateProfileResult> => {
    const name = validateProfileName(rawName);
    if (name === null) return { ok: false, code: "invalid" };
    if (avatar !== null && !isProfileAvatar(avatar)) return { ok: false, code: "invalid_avatar" };

    try {
        const owned = await repo.isProfileOwnedByUser(profileId, userId);
        if (!owned) return { ok: false, code: "forbidden" };

        await repo.updateProfileById(profileId, name, avatar);
        return { ok: true, profile: { id: profileId, name, avatar } };
    } catch (error) {
        if (error instanceof DatabaseError && error.code === "conflict") return { ok: false, code: "conflict" };
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type RenameProfileResult =
    | { ok: true; profile: { id: number; name: string } }
    | { ok: false; code: "invalid" | "forbidden" | "conflict" | "server" };

export const renameProfile = async (userId: number, profileId: number, rawName: string): Promise<RenameProfileResult> => {
    const name = validateProfileName(rawName);
    if (name === null) return { ok: false, code: "invalid" };

    try {
        const owned = await repo.isProfileOwnedByUser(profileId, userId);
        if (!owned) return { ok: false, code: "forbidden" };

        await repo.renameProfileById(profileId, name);
        return { ok: true, profile: { id: profileId, name } };
    } catch (error) {
        if (error instanceof DatabaseError && error.code === "conflict") return { ok: false, code: "conflict" };
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type DeleteProfileResult = { ok: true } | { ok: false; code: "forbidden" | "last_profile" | "server" };

export const deleteProfile = async (userId: number, profileId: number): Promise<DeleteProfileResult> => {
    try {
        const owned = await repo.isProfileOwnedByUser(profileId, userId);
        if (!owned) return { ok: false, code: "forbidden" };

        const count = await repo.countProfilesForUser(userId);
        if (count <= 1) return { ok: false, code: "last_profile" };

        await withTransaction(async (connection) => {
            const wasDefault = await repo.isProfileDefault(profileId, connection);
            await repo.deleteProfileById(profileId, connection);
            if (wasDefault) await repo.promoteFirstProfileToDefault(userId, connection);
        });

        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export const resolveOwnedProfileId = async (userId: number, username: string): Promise<number> => {
    const requested = await selectedProfileId();

    if (requested !== null && /^\d+$/.test(requested)) {
        const requestedId = Number(requested);
        if (await repo.isProfileOwnedByUser(requestedId, userId)) return requestedId;
    }

    return ensureDefaultProfile(userId, username);
};
