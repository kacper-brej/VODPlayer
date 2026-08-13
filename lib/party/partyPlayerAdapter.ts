import type { WatchPartyState } from "@/lib/core/contracts";
import type { DriftCorrectionDecision } from "@/lib/party/driftCorrection";

export interface PartyPlayerPort {
    currentTime: number;
    playbackRate: number;
    paused: boolean;
    play: () => Promise<void>;
    pause: () => Promise<void>;
}

export interface PartyPlaybackReading {
    positionSeconds: number;
    state: WatchPartyState;
    playbackRate: number;
    buffering: boolean;
}

export interface PartyPlaybackAdapter {
    read: () => PartyPlaybackReading | null;
    correct: (decision: DriftCorrectionDecision) => boolean;
}

export const PARTY_ANCHOR_SEEK_TOLERANCE_SECONDS = 0.5;

const alignPartyPosition = (player: PartyPlayerPort, position: number | null) => {
    if (position === null || !Number.isFinite(position)) return;
    if (Math.abs(player.currentTime - position) < PARTY_ANCHOR_SEEK_TOLERANCE_SECONDS) return;
    player.currentTime = position;
};

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
    alignPartyPosition(player, position);
    if (player.playbackRate !== 1) player.playbackRate = 1;
    if (state === "paused") {
        if (!player.paused) await player.pause().catch(() => undefined);
        return "applied";
    }
    if (!player.paused) return "applied";
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
    alignPartyPosition(player, position);
    try {
        await player.play();
        return true;
    } catch {
        return false;
    }
};
