import "server-only";
import { deleteB2Prefix, DeleteB2ConfigError } from "@/lib/admin/b2AdminStorage";
import {
    beginMediaDeletion,
    finalizeMediaDeletion,
    markMediaDeletionFailed,
} from "@/lib/admin/mediaDeleteRepository";
import {
    canonicalMediaPrefix,
    isCanonicalMediaPrefix,
    isSafeMediaIdentitySegment,
} from "@/lib/media/mediaLifecycle";

const safeDeleteError = (error: unknown): string => {
    if (error instanceof DeleteB2ConfigError) return "Brak konfiguracji klienta usuwającego B2.";
    return "Usuwanie obiektów B2 nie powiodło się; operację można bezpiecznie ponowić.";
};

export const isSafeMediaSegment = isSafeMediaIdentitySegment;

export const deleteMedia = async (seriesKey: string, episodeKey: string) => {
    if (!isSafeMediaIdentitySegment(seriesKey) || !isSafeMediaIdentitySegment(episodeKey)) {
        return { ok: false as const, code: "invalid" as const };
    }

    const claim = await beginMediaDeletion(seriesKey, episodeKey);
    if (claim.kind === "not_found") {
        return { ok: true as const, state: "not_found" as const, existed: false, deletedB2Objects: 0 };
    }
    if (claim.kind === "deleted") {
        return { ok: true as const, state: "deleted" as const, existed: true, deletedB2Objects: 0 };
    }
    if (claim.kind === "in_progress") {
        return { ok: true as const, state: "in_progress" as const, existed: true, deletedB2Objects: 0 };
    }

    const expectedPrefix = canonicalMediaPrefix(seriesKey, episodeKey);
    if (!isCanonicalMediaPrefix(claim.storagePrefix, seriesKey, episodeKey)) {
        await markMediaDeletionFailed(claim.assetId, "Zapisany storage_prefix nie jest canonical prefixem assetu.");
        return { ok: false as const, code: "unsafe_prefix" as const };
    }

    try {
        const deletedB2Objects = await deleteB2Prefix(`${expectedPrefix}/`);
        const finalized = await finalizeMediaDeletion(claim.assetId);
        if (!finalized) throw new Error("Nie udało się sfinalizować stanu delete.");
        return { ok: true as const, state: "deleted" as const, existed: true, deletedB2Objects };
    } catch (error) {
        try {
            await markMediaDeletionFailed(claim.assetId, safeDeleteError(error));
        } catch (markError) {
            console.error("deleteMedia: nie udało się zapisać stanu delete_failed", markError);
        }
        throw error;
    }
};
