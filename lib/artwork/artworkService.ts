import "server-only";
import { randomUUID } from "node:crypto";
import { DatabaseError } from "@/lib/db/errors";
import {
    ArtworkProcessingError,
    processArtwork,
} from "@/lib/artwork/artworkProcessor";
import { ArtworkValidationError } from "@/lib/artwork/artworkValidation";
import {
    findArtworkStorageKey,
    replaceManualArtworkRecord,
} from "@/lib/artwork/artworkRepository";
import {
    ArtworkStorageConfigError,
    deleteArtworkObject,
    isArtworkStorageKey,
    presignArtworkObject,
    putArtworkObject,
} from "@/lib/artwork/artworkStorage";

const ARTWORK_PRESIGN_TTL_SECONDS = 21_600;
const ARTWORK_KINDS = new Set(["poster", "backdrop", "logo"]);

export type ArtworkKind = "poster" | "backdrop" | "logo";

export type SaveArtworkResult =
    | { ok: true; id: number; url: string }
    | { ok: false; code: "invalid" | "invalid_dimensions" | "not_found" | "storage" | "server" };

export type ArtworkRedirectResult =
    | { ok: true; url: string }
    | { ok: false; code: "not_found" | "storage" | "server" };

export const isSafeArtworkSeriesKey = (value: string): boolean =>
    value.length > 0
    && value.length <= 255
    && !value.startsWith(".")
    && !/[\x00-\x1f\x7f/\\]/u.test(value);

export const isArtworkKind = (value: string): value is ArtworkKind => ARTWORK_KINDS.has(value);

const dimensionsMatchKind = (kind: ArtworkKind, width: number, height: number): boolean => {
    if (kind === "poster") return width < height;
    if (kind === "backdrop") return width > height;
    return true;
};

const removeNewObjectAfterFailure = async (storageKey: string): Promise<void> => {
    try {
        await deleteArtworkObject(storageKey);
    } catch (error) {
        console.error("saveManualArtwork: nie udało się posprzątać nowego obiektu B2", storageKey, error);
    }
};

export const saveManualArtwork = async (
    seriesKey: string,
    kind: ArtworkKind,
    input: Buffer | Uint8Array,
): Promise<SaveArtworkResult> => {
    if (!isSafeArtworkSeriesKey(seriesKey) || !isArtworkKind(kind)) {
        return { ok: false, code: "invalid" };
    }

    let processed;
    try {
        processed = await processArtwork(input, { normalizeToWebp: true });
    } catch (error) {
        if (error instanceof ArtworkValidationError || error instanceof ArtworkProcessingError) {
            return { ok: false, code: "invalid" };
        }
        throw error;
    }

    if (!dimensionsMatchKind(kind, processed.width, processed.height)) {
        return { ok: false, code: "invalid_dimensions" };
    }

    const storageKey = `artwork/${seriesKey}/${kind}/${randomUUID()}.webp`;

    try {
        await putArtworkObject(storageKey, processed.data);
    } catch (error) {
        console.error("saveManualArtwork: zapis B2 nie powiódł się", error);
        return { ok: false, code: "storage" };
    }

    let saved;
    try {
        saved = await replaceManualArtworkRecord({
            seriesKey,
            kind,
            storageKey,
            width: processed.width,
            height: processed.height,
            dominantColor: processed.dominantColor,
            placeholder: processed.placeholder,
        });
    } catch (error) {
        await removeNewObjectAfterFailure(storageKey);
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }

    if (!saved) {
        await removeNewObjectAfterFailure(storageKey);
        return { ok: false, code: "not_found" };
    }

    for (const oldStorageKey of new Set(saved.replacedStorageKeys)) {
        if (!isArtworkStorageKey(oldStorageKey) || oldStorageKey === storageKey) continue;
        try {
            await deleteArtworkObject(oldStorageKey);
        } catch (error) {
            console.error("saveManualArtwork: stary obiekt B2 pozostał do posprzątania", oldStorageKey, error);
        }
    }

    return { ok: true, id: saved.id, url: saved.url };
};

export const buildArtworkRedirect = async (artworkId: number): Promise<ArtworkRedirectResult> => {
    try {
        const storageKey = await findArtworkStorageKey(artworkId);
        if (!storageKey || !isArtworkStorageKey(storageKey)) return { ok: false, code: "not_found" };
        return {
            ok: true,
            url: await presignArtworkObject(storageKey, ARTWORK_PRESIGN_TTL_SECONDS),
        };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        if (error instanceof ArtworkStorageConfigError) {
            console.error("buildArtworkRedirect: brak konfiguracji B2", error);
            return { ok: false, code: "storage" };
        }
        console.error("buildArtworkRedirect: podpisanie grafiki B2 nie powiodło się", error);
        return { ok: false, code: "storage" };
    }
};
