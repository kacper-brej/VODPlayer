import "server-only";
import { registerComplete, registerFailed, registerStart } from "@/lib/media/mediaRegistryRepository";
import {
    canonicalMediaPrefix,
    canonicalPreviewClipKey,
    canonicalRenditionPlaylistKey,
    isSafeMediaIdentitySegment,
    MAX_MEDIA_RENDITIONS,
    MAX_MEDIA_SEGMENTS_PER_RENDITION,
    MEDIA_RENDITION_HEIGHTS,
    normalizePreviewStart,
} from "@/lib/media/mediaLifecycle";

const ALLOWED_HEIGHTS = new Set<number>(MEDIA_RENDITION_HEIGHTS);
const MAX_ERROR_MESSAGE_LENGTH = 2000;

export class MediaRegistryValidationError extends Error {
    readonly code = "invalid_media_registration";

    constructor(message: string) {
        super(message);
        this.name = "MediaRegistryValidationError";
    }
}

export interface StartRegistration {
    phase: "start";
    seriesKey: string;
    episodeKey: string;
    operationId: string;
    storagePrefix: string;
    durationSeconds: number;
    sourceSizeBytes: number | null;
    previewStartSeconds: number | null;
}

export interface RenditionRegistration {
    height: number;
    width: number | null;
    bitrateKbps: number;
    playlistKey: string;
    segmentCount: number | null;
    sizeBytes: number | null;
}

export interface CompleteRegistration {
    phase: "complete";
    seriesKey: string;
    episodeKey: string;
    operationId: string;
    totalSizeBytes: number | null;
    previewClipKey: string | null;
    renditions: RenditionRegistration[];
}

interface FailedRegistration {
    phase: "failed";
    seriesKey: string;
    episodeKey: string;
    operationId: string;
    errorMessage: string;
}

export type MediaRegistration = StartRegistration | CompleteRegistration | FailedRegistration;

const objectValue = (value: unknown): Record<string, unknown> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new MediaRegistryValidationError("Nieprawidłowe dane.");
    }
    return value as Record<string, unknown>;
};

const seriesKey = (value: unknown): string => {
    if (typeof value !== "string") throw new MediaRegistryValidationError("Nieprawidłowa wartość pola seriesKey.");
    const key = value.trim();
    if (!isSafeMediaIdentitySegment(key)) {
        throw new MediaRegistryValidationError("Nieprawidłowa wartość pola seriesKey.");
    }
    return key;
};

const episodeKey = (value: unknown): string => {
    if (typeof value !== "string" || !isSafeMediaIdentitySegment(value) || !/^[^.]+\.mp4$/iu.test(value)) {
        throw new MediaRegistryValidationError("Nieprawidłowa wartość pola episodeKey.");
    }
    return value;
};

const exactStorageKey = (value: unknown, expected: string, field: string): string => {
    if (typeof value !== "string" || value !== expected) {
        throw new MediaRegistryValidationError(`Nieprawidłowa wartość pola ${field}.`);
    }
    return value;
};

const integer = (value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
    const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
    if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        throw new MediaRegistryValidationError(`Nieprawidłowa wartość pola ${field}.`);
    }
    return parsed;
};

const nullableInteger = (value: unknown, field: string): number | null =>
    value === null ? null : integer(value, field);

const operationId = (value: unknown): string => {
    if (typeof value !== "string" || !/^[0-9a-f]{64}$/iu.test(value)) {
        throw new MediaRegistryValidationError("Nieprawidłowa wartość pola operationId.");
    }
    return value.toLowerCase();
};

export const parseMediaRegistration = (value: unknown): MediaRegistration => {
    const payload = objectValue(value);
    const phase = payload.phase;
    if (phase !== "start" && phase !== "complete" && phase !== "failed") {
        throw new MediaRegistryValidationError("Nieprawidłowa wartość pola phase.");
    }
    const common = {
        phase,
        seriesKey: seriesKey(payload.seriesKey),
        episodeKey: episodeKey(payload.episodeKey),
        operationId: operationId(payload.operationId),
    };

    if (phase === "start") {
        const durationSeconds = integer(payload.durationSeconds, "durationSeconds", 10, 86_400);
        const expectedPrefix = canonicalMediaPrefix(common.seriesKey, common.episodeKey);
        const rawPreviewStart = nullableInteger(payload.previewStartSeconds, "previewStartSeconds");
        return {
            ...common,
            phase,
            storagePrefix: exactStorageKey(payload.storagePrefix, expectedPrefix, "storagePrefix"),
            durationSeconds,
            sourceSizeBytes: nullableInteger(payload.sourceSizeBytes, "sourceSizeBytes"),
            previewStartSeconds: normalizePreviewStart(rawPreviewStart, durationSeconds),
        };
    }

    if (phase === "failed") {
        if (typeof payload.errorMessage !== "string" || !payload.errorMessage.trim()) {
            throw new MediaRegistryValidationError("Nieprawidłowa wartość pola errorMessage.");
        }
        return { ...common, phase, errorMessage: payload.errorMessage.trim().slice(0, MAX_ERROR_MESSAGE_LENGTH) };
    }

    if (!Array.isArray(payload.renditions) || payload.renditions.length === 0 || payload.renditions.length > MAX_MEDIA_RENDITIONS) {
        throw new MediaRegistryValidationError("Nieprawidłowa lista renditions.");
    }
    const seen = new Set<number>();
    const renditions = payload.renditions.map((raw) => {
        const rendition = objectValue(raw);
        const height = integer(rendition.height, "height");
        if (!ALLOWED_HEIGHTS.has(height)) throw new MediaRegistryValidationError("Nieprawidłowa wartość pola height.");
        if (seen.has(height)) throw new MediaRegistryValidationError("Zduplikowana wysokość w renditions.");
        seen.add(height);
        return {
            height,
            width: nullableInteger(rendition.width, "width"),
            bitrateKbps: integer(rendition.bitrateKbps, "bitrateKbps", 1),
            playlistKey: exactStorageKey(
                rendition.playlistKey,
                canonicalRenditionPlaylistKey(common.seriesKey, common.episodeKey, height),
                "playlistKey",
            ),
            segmentCount: rendition.segmentCount === null
                ? null
                : integer(rendition.segmentCount, "segmentCount", 1, MAX_MEDIA_SEGMENTS_PER_RENDITION),
            sizeBytes: nullableInteger(rendition.sizeBytes, "sizeBytes"),
        };
    });
    return {
        ...common,
        phase,
        totalSizeBytes: nullableInteger(payload.totalSizeBytes, "totalSizeBytes"),
        previewClipKey: payload.previewClipKey === null
            ? null
            : exactStorageKey(
                payload.previewClipKey,
                canonicalPreviewClipKey(common.seriesKey, common.episodeKey),
                "previewClipKey",
            ),
        renditions,
    };
};

export const saveMediaRegistration = async (input: MediaRegistration) => {
    if (input.phase === "start") return registerStart(input);
    if (input.phase === "complete") return registerComplete(input);
    return registerFailed(input.seriesKey, input.episodeKey, input.operationId, input.errorMessage);
};
