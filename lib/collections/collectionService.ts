import "server-only";
import { withTransaction } from "@/lib/db/transaction";
import { DatabaseError } from "@/lib/db/errors";
import type { CollectionSummary, CollectionDetail } from "@/lib/core/contracts";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import * as repo from "@/lib/collections/collectionRepository";

const MAX_COLLECTIONS_PER_PROFILE = 20;
const MAX_NAME_LENGTH = 100;
const MAX_SERIES_KEY_LENGTH = 255;

const validateName = (raw: string): string | null => {
    const name = raw.trim();
    if (name === "" || name.length > MAX_NAME_LENGTH) return null;
    return name;
};

export const listCollections = async (userId: number, username: string): Promise<CollectionSummary[]> => {
    const profileId = await resolveOwnedProfileId(userId, username);
    return repo.listCollectionsForProfile(profileId);
};

export type CollectionDetailResult =
    | { ok: true; detail: CollectionDetail }
    | { ok: false; code: "invalid" | "forbidden" };

export const getCollectionDetail = async (
    userId: number,
    username: string,
    collectionId: number,
): Promise<CollectionDetailResult> => {
    if (!Number.isSafeInteger(collectionId) || collectionId <= 0) return { ok: false, code: "invalid" };

    const profileId = await resolveOwnedProfileId(userId, username);
    const owned = await repo.isCollectionOwnedByProfile(collectionId, profileId);
    if (!owned) return { ok: false, code: "forbidden" };

    const [meta, items] = await Promise.all([
        repo.getCollectionMeta(collectionId),
        repo.listCollectionItems(collectionId),
    ]);
    if (!meta) return { ok: false, code: "forbidden" };

    return { ok: true, detail: { id: collectionId, name: meta.name, createdAt: meta.createdAt, items } };
};

export type CreateCollectionResult =
    | { ok: true; id: number; name: string; createdAt: number }
    | { ok: false; code: "invalid" | "limit" | "conflict" | "server" };

export const createCollection = async (
    userId: number,
    username: string,
    rawName: string,
): Promise<CreateCollectionResult> => {
    const name = validateName(rawName);
    if (name === null) return { ok: false, code: "invalid" };

    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        const count = await repo.countCollectionsForProfile(profileId);
        if (count >= MAX_COLLECTIONS_PER_PROFILE) return { ok: false, code: "limit" };

        const id = await repo.insertCollection(profileId, name);
        const meta = await repo.getCollectionMeta(id);

        return { ok: true, id, name, createdAt: meta?.createdAt ?? Math.floor(Date.now() / 1000) };
    } catch (error) {
        if (error instanceof DatabaseError && error.code === "conflict") return { ok: false, code: "conflict" };
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type MutationResult = { ok: true } | { ok: false; code: "invalid" | "forbidden" | "conflict" | "server" };
export type RenameCollectionResult =
    | { ok: true; id: number; name: string }
    | { ok: false; code: "invalid" | "forbidden" | "conflict" | "server" };

export const renameCollection = async (
    userId: number,
    username: string,
    collectionId: number,
    rawName: string,
): Promise<RenameCollectionResult> => {
    const name = validateName(rawName);
    if (name === null) return { ok: false, code: "invalid" };

    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        const owned = await repo.isCollectionOwnedByProfile(collectionId, profileId);
        if (!owned) return { ok: false, code: "forbidden" };

        await repo.renameCollectionById(collectionId, name);
        return { ok: true, id: collectionId, name };
    } catch (error) {
        if (error instanceof DatabaseError && error.code === "conflict") return { ok: false, code: "conflict" };
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export const deleteCollection = async (
    userId: number,
    username: string,
    collectionId: number,
): Promise<MutationResult> => {
    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        const owned = await repo.isCollectionOwnedByProfile(collectionId, profileId);
        if (!owned) return { ok: false, code: "forbidden" };

        await withTransaction(async (connection) => {
            await repo.deleteCollectionItemsByCollectionId(collectionId, connection);
            await repo.deleteCollectionById(collectionId, connection);
        });

        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

const validateSeriesKey = (raw: string): string | null => {
    const key = raw.trim();
    if (key === "" || key.length > MAX_SERIES_KEY_LENGTH) return null;
    return key;
};

export type AddItemResult = { ok: true; seriesKey: string } | { ok: false; code: "invalid" | "forbidden" | "server" };

export const addToCollection = async (
    userId: number,
    username: string,
    collectionId: number,
    rawSeriesKey: string,
): Promise<AddItemResult> => {
    const seriesKey = validateSeriesKey(rawSeriesKey);
    if (seriesKey === null) return { ok: false, code: "invalid" };

    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        const owned = await repo.isCollectionOwnedByProfile(collectionId, profileId);
        if (!owned) return { ok: false, code: "forbidden" };

        await repo.upsertCollectionItem(collectionId, seriesKey);
        return { ok: true, seriesKey };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export const removeFromCollection = async (
    userId: number,
    username: string,
    collectionId: number,
    rawSeriesKey: string,
): Promise<MutationResult> => {
    const seriesKey = validateSeriesKey(rawSeriesKey);
    if (seriesKey === null) return { ok: false, code: "invalid" };

    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        const owned = await repo.isCollectionOwnedByProfile(collectionId, profileId);
        if (!owned) return { ok: false, code: "forbidden" };

        await repo.deleteCollectionItem(collectionId, seriesKey);
        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
