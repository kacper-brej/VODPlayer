import type { WatchPartyState } from "@/lib/core/contracts";

export const DRIFT_DEAD_ZONE_SECONDS = 0.25;
export const DRIFT_RATE_EXIT_SECONDS = 0.1;
export const DRIFT_SEEK_THRESHOLD_SECONDS = 2;
export const MIN_PARTY_PLAYBACK_RATE = 0.95;
export const MAX_PARTY_PLAYBACK_RATE = 1.05;

export interface DriftCorrectionInput {
    expectedPositionSeconds: number;
    actualPositionSeconds: number;
    playbackState: WatchPartyState;
    currentPlaybackRate?: number;
}

export type DriftCorrectionDecision =
    | { kind: "none" }
    | { kind: "rate"; playbackRate: number }
    | { kind: "seek"; positionSeconds: number };

const clamp = (value: number, minimum: number, maximum: number): number =>
    Math.min(maximum, Math.max(minimum, value));

const isRateCorrectionActive = (playbackRate: number): boolean =>
    Math.abs(playbackRate - 1) > 0.0001;

export const decideDriftCorrection = ({
    expectedPositionSeconds,
    actualPositionSeconds,
    playbackState,
    currentPlaybackRate = 1,
}: DriftCorrectionInput): DriftCorrectionDecision => {
    if (!Number.isFinite(expectedPositionSeconds) || !Number.isFinite(actualPositionSeconds)) return { kind: "none" };

    const driftSeconds = expectedPositionSeconds - actualPositionSeconds;
    const absoluteDrift = Math.abs(driftSeconds);
    const correctionActive = isRateCorrectionActive(currentPlaybackRate);

    if (playbackState === "paused") {
        if (absoluteDrift >= DRIFT_DEAD_ZONE_SECONDS) {
            return { kind: "seek", positionSeconds: Math.max(0, expectedPositionSeconds) };
        }
        return correctionActive ? { kind: "rate", playbackRate: 1 } : { kind: "none" };
    }

    if (absoluteDrift > DRIFT_SEEK_THRESHOLD_SECONDS) {
        return { kind: "seek", positionSeconds: Math.max(0, expectedPositionSeconds) };
    }

    if (correctionActive && absoluteDrift <= DRIFT_RATE_EXIT_SECONDS) {
        return { kind: "rate", playbackRate: 1 };
    }

    if (!correctionActive && absoluteDrift < DRIFT_DEAD_ZONE_SECONDS) return { kind: "none" };

    const playbackRate = clamp(
        1 + driftSeconds * 0.04,
        MIN_PARTY_PLAYBACK_RATE,
        MAX_PARTY_PLAYBACK_RATE,
    );
    return { kind: "rate", playbackRate };
};
