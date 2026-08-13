import type { DriftCorrectionDecision } from "@/lib/party/driftCorrection";

export const PARTY_SEEK_COOLDOWN_MS = 6_000;
export const PARTY_SEEK_CONFIRMATIONS = 2;

export interface DriftGovernorState {
    seekVotes: number;
    lastSeekAtMs: number | null;
}

export interface DriftGovernorInput {
    decision: DriftCorrectionDecision;
    state: DriftGovernorState;
    nowMs: number;
    playerBusy: boolean;
    aloneInRoom: boolean;
}

export interface DriftGovernorOutput {
    decision: DriftCorrectionDecision;
    state: DriftGovernorState;
}

export const initialDriftGovernorState = (): DriftGovernorState => ({ seekVotes: 0, lastSeekAtMs: null });

export const governDriftCorrection = ({
    decision,
    state,
    nowMs,
    playerBusy,
    aloneInRoom,
}: DriftGovernorInput): DriftGovernorOutput => {
    if (aloneInRoom || playerBusy) {
        return { decision: { kind: "none" }, state: { ...state, seekVotes: 0 } };
    }

    if (decision.kind !== "seek") {
        return { decision, state: { ...state, seekVotes: 0 } };
    }

    const seekVotes = state.seekVotes + 1;
    const inCooldown = state.lastSeekAtMs !== null && nowMs - state.lastSeekAtMs < PARTY_SEEK_COOLDOWN_MS;
    if (inCooldown || seekVotes < PARTY_SEEK_CONFIRMATIONS) {
        return { decision: { kind: "none" }, state: { ...state, seekVotes } };
    }

    return { decision, state: { seekVotes: 0, lastSeekAtMs: nowMs } };
};
