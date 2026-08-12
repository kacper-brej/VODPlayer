import { isEpisodeComplete } from "@/lib/progress/watchProgress";

export const PREVIEW_RESUME_REWIND_SECONDS = 10;
export const PREVIEW_PLAYBACK_DURATION_SECONDS = 10;
export const PREVIEW_FILE_MAX_DURATION_SECONDS = 30;
export const PREVIEW_SAFE_FALLBACK_SECONDS = 30;

export type PreviewDecisionReason = "resume" | "editorial" | "default" | "completed-fallback";

export interface PreviewDecision {
    assetId: number;
    assetVersion: number;
    sourceTimelineStartSeconds: number;
    mediaOffsetSeconds: number;
    durationSeconds: number;
    reason: PreviewDecisionReason;
}

export interface PreviewProgressInput {
    assetVersion: number | null;
    positionSeconds: number;
    durationSeconds: number;
    completed: boolean;
}

export interface PreviewPolicyInput {
    assetId: number;
    assetVersion: number;
    durationSeconds: number;
    previewStartSeconds: number | null;
    progress: PreviewProgressInput | null;
}

const finiteNonNegative = (value: number | null): value is number =>
    value !== null && Number.isFinite(value) && value >= 0;

const fallbackStart = (
    durationSeconds: number,
    previewStartSeconds: number | null,
): { start: number; reason: "editorial" | "default" } => {
    const previewDuration = Math.min(PREVIEW_PLAYBACK_DURATION_SECONDS, durationSeconds);
    const latestSafeStart = Math.max(0, durationSeconds - previewDuration);
    const editorial = finiteNonNegative(previewStartSeconds) ? previewStartSeconds : null;
    return {
        start: Math.min(editorial ?? PREVIEW_SAFE_FALLBACK_SECONDS, latestSafeStart),
        reason: editorial === null ? "default" : "editorial",
    };
};

const validProgress = (
    progress: PreviewProgressInput | null,
    assetVersion: number,
    durationSeconds: number,
): progress is PreviewProgressInput => {
    if (!progress || progress.assetVersion !== assetVersion) return false;
    if (!Number.isFinite(progress.positionSeconds) || progress.positionSeconds < 0) return false;
    if (!Number.isFinite(progress.durationSeconds) || progress.durationSeconds <= 0) return false;
    if (progress.positionSeconds > durationSeconds) return false;
    const durationTolerance = Math.max(5, durationSeconds * 0.02);
    return Math.abs(progress.durationSeconds - durationSeconds) <= durationTolerance;
};

export const decidePreview = (input: PreviewPolicyInput): PreviewDecision | null => {
    if (!Number.isSafeInteger(input.assetId) || input.assetId <= 0) return null;
    if (!Number.isSafeInteger(input.assetVersion) || input.assetVersion < 0) return null;
    if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) return null;

    const durationSeconds = input.durationSeconds;
    const previewDuration = Math.min(PREVIEW_PLAYBACK_DURATION_SECONDS, durationSeconds);
    const fallback = fallbackStart(durationSeconds, input.previewStartSeconds);
    const progress = validProgress(input.progress, input.assetVersion, durationSeconds)
        ? input.progress
        : null;
    const completed = progress !== null && (
        progress.completed || isEpisodeComplete(progress.positionSeconds, durationSeconds)
    );

    if (completed) {
        return {
            assetId: input.assetId,
            assetVersion: input.assetVersion,
            sourceTimelineStartSeconds: fallback.start,
            mediaOffsetSeconds: 0,
            durationSeconds: previewDuration,
            reason: "completed-fallback",
        };
    }

    if (progress !== null && progress.positionSeconds > 0) {
        const latestSafeStart = Math.max(0, durationSeconds - previewDuration);
        return {
            assetId: input.assetId,
            assetVersion: input.assetVersion,
            sourceTimelineStartSeconds: Math.min(
                Math.max(0, progress.positionSeconds - PREVIEW_RESUME_REWIND_SECONDS),
                latestSafeStart,
            ),
            mediaOffsetSeconds: 0,
            durationSeconds: previewDuration,
            reason: "resume",
        };
    }

    return {
        assetId: input.assetId,
        assetVersion: input.assetVersion,
        sourceTimelineStartSeconds: fallback.start,
        mediaOffsetSeconds: 0,
        durationSeconds: previewDuration,
        reason: fallback.reason,
    };
};
