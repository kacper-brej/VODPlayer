import { describe, expect, it } from "vitest";
import {
    governDriftCorrection,
    initialDriftGovernorState,
    PARTY_SEEK_COOLDOWN_MS,
    type DriftGovernorState,
} from "../driftGovernor";

const seek = { kind: "seek", positionSeconds: 120 } as const;

describe("driftGovernor", () => {
    it("nie koryguje niczego, gdy widz jest sam w pokoju", () => {
        const result = governDriftCorrection({
            decision: seek,
            state: initialDriftGovernorState(),
            nowMs: 1000,
            playerBusy: false,
            aloneInRoom: true,
        });
        expect(result.decision).toEqual({ kind: "none" });
    });

    it("nie przewija odtwarzacza, który buforuje", () => {
        const result = governDriftCorrection({
            decision: seek,
            state: { seekVotes: 5, lastSeekAtMs: null },
            nowMs: 1000,
            playerBusy: true,
            aloneInRoom: false,
        });
        expect(result.decision).toEqual({ kind: "none" });
        expect(result.state.seekVotes).toBe(0);
    });

    it("wymaga dwóch kolejnych potwierdzeń przed twardym przewinięciem", () => {
        const first = governDriftCorrection({
            decision: seek,
            state: initialDriftGovernorState(),
            nowMs: 1000,
            playerBusy: false,
            aloneInRoom: false,
        });
        expect(first.decision).toEqual({ kind: "none" });

        const second = governDriftCorrection({
            decision: seek,
            state: first.state,
            nowMs: 2000,
            playerBusy: false,
            aloneInRoom: false,
        });
        expect(second.decision).toEqual(seek);
        expect(second.state.lastSeekAtMs).toBe(2000);
    });

    it("blokuje pętlę przewijanie-buforowanie przez okres wyciszenia", () => {
        let state: DriftGovernorState = { seekVotes: 1, lastSeekAtMs: 2000 };
        for (let nowMs = 3000; nowMs < 2000 + PARTY_SEEK_COOLDOWN_MS; nowMs += 1000) {
            const result = governDriftCorrection({
                decision: seek,
                state,
                nowMs,
                playerBusy: false,
                aloneInRoom: false,
            });
            expect(result.decision).toEqual({ kind: "none" });
            state = result.state;
        }

        const afterCooldown = governDriftCorrection({
            decision: seek,
            state,
            nowMs: 2000 + PARTY_SEEK_COOLDOWN_MS,
            playerBusy: false,
            aloneInRoom: false,
        });
        expect(afterCooldown.decision).toEqual(seek);
    });

    it("korekty tempem przechodzą bez zwłoki i zerują głosy", () => {
        const result = governDriftCorrection({
            decision: { kind: "rate", playbackRate: 1.02 },
            state: { seekVotes: 1, lastSeekAtMs: null },
            nowMs: 1000,
            playerBusy: false,
            aloneInRoom: false,
        });
        expect(result.decision).toEqual({ kind: "rate", playbackRate: 1.02 });
        expect(result.state.seekVotes).toBe(0);
    });
});
