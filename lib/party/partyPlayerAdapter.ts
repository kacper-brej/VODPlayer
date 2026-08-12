import type { WatchPartyState } from "@/lib/core/contracts";
import type { DriftCorrectionDecision } from "@/lib/party/driftCorrection";

export interface PartyPlayerPort {
    currentTime: number;
    playbackRate: number;
    paused: boolean;
    play: () => Promise<void>;
    pause: () => Promise<void>;
}

export interface PartyPlaybackAdapter {
    read: () => {
        positionSeconds: number;
        state: WatchPartyState;
        playbackRate: number;
    } | null;
    correct: (decision: DriftCorrectionDecision) => boolean;
}

export const applyPartyCorrection = (
    player: PartyPlayerPort | null,
    decision: DriftCorrectionDecision,
    ready: boolean,
    seeking: boolean,
): boolean => {
    if (player === null || !ready || seeking || decision.kind === "none") return false;
    if (decision.kind === "seek") player.currentTime = decision.positionSeconds;
    else player.playbackRate = decision.playbackRate === 1 ? 1 : decision.playbackRate;
    return true;
};

export const applyPartyAnchor = async (
    player: PartyPlayerPort | null,
    state: WatchPartyState,
    expectedPosition: () => number | null,
): Promise<"applied" | "gesture-required" | "unavailable"> => {
    if (player === null) return "unavailable";
    const position = expectedPosition();
    if (position !== null) player.currentTime = position;
    player.playbackRate = 1;
    if (state === "paused") {
        await player.pause().catch(() => undefined);
        return "applied";
    }
    try {
        await player.play();
        return "applied";
    } catch {
        return "gesture-required";
    }
};

export const resumePartyPlaybackAfterGesture = async (
    player: PartyPlayerPort | null,
    expectedPosition: () => number | null,
): Promise<boolean> => {
    if (player === null) return false;
    const position = expectedPosition();
    if (position !== null) player.currentTime = position;
    try {
        await player.play();
        return true;
    } catch {
        return false;
    }
};
