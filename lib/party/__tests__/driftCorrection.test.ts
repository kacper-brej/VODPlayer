import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decideDriftCorrection, type DriftCorrectionInput } from "../driftCorrection";
import { resolvePosition } from "../partyService";

describe("korekcja dryfu", () => {
    it.each<{ name: string; input: DriftCorrectionInput; expected: unknown }>([
        {
            name: "poniżej 0,25 s nie robi nic",
            input: { expectedPositionSeconds: 10.249, actualPositionSeconds: 10, playbackState: "playing" },
            expected: { kind: "none" },
        },
        {
            name: "dokładnie 0,25 s zaczyna korektę tempem",
            input: { expectedPositionSeconds: 10.25, actualPositionSeconds: 10, playbackState: "playing" },
            expected: { kind: "rate", playbackRate: 1.01 },
        },
        {
            name: "spóźniony odtwarzacz przyspiesza najwyżej do 1,05",
            input: { expectedPositionSeconds: 11.5, actualPositionSeconds: 10, playbackState: "playing" },
            expected: { kind: "rate", playbackRate: 1.05 },
        },
        {
            name: "wyprzedzający odtwarzacz zwalnia najwyżej do 0,95",
            input: { expectedPositionSeconds: 10, actualPositionSeconds: 11.5, playbackState: "playing" },
            expected: { kind: "rate", playbackRate: 0.95 },
        },
        {
            name: "dokładnie 2 s nadal koryguje tempem",
            input: { expectedPositionSeconds: 12, actualPositionSeconds: 10, playbackState: "playing" },
            expected: { kind: "rate", playbackRate: 1.05 },
        },
        {
            name: "powyżej 2 s wykonuje seek",
            input: { expectedPositionSeconds: 12.001, actualPositionSeconds: 10, playbackState: "playing" },
            expected: { kind: "seek", positionSeconds: 12.001 },
        },
        {
            name: "aktywną korektę utrzymuje wewnątrz martwej strefy",
            input: {
                expectedPositionSeconds: 10.2,
                actualPositionSeconds: 10,
                playbackState: "playing",
                currentPlaybackRate: 1.03,
            },
            expected: { kind: "rate", playbackRate: 1.008 },
        },
        {
            name: "histereza wyłącza korektę dopiero przy 0,1 s",
            input: {
                expectedPositionSeconds: 10.1,
                actualPositionSeconds: 10,
                playbackState: "playing",
                currentPlaybackRate: 1.03,
            },
            expected: { kind: "rate", playbackRate: 1 },
        },
        {
            name: "w pauzie różnicę koryguje seekiem, bo tempo nie przesuwa klatki",
            input: { expectedPositionSeconds: 20.3, actualPositionSeconds: 20, playbackState: "paused" },
            expected: { kind: "seek", positionSeconds: 20.3 },
        },
    ])("$name", ({ input, expected }) => {
        expect(decideDriftCorrection(input)).toEqual(expected);
    });

    it("resolvePosition i korekta utrzymują symulowany dryf 500 ppm w martwej strefie po 10 minutach", () => {
        const anchor = {
            state: "playing" as const,
            positionSeconds: 0,
            anchorAtMs: 1_700_000_000_000,
            anchorVersion: 1,
        };
        const hardwareRate = 0.9995;
        let playbackRate = 1;
        let actualPosition = 0;

        for (let second = 1; second <= 600; second += 1) {
            actualPosition += hardwareRate * playbackRate;
            const expectedPosition = resolvePosition(anchor, anchor.anchorAtMs + second * 1000);
            const decision = decideDriftCorrection({
                expectedPositionSeconds: expectedPosition,
                actualPositionSeconds: actualPosition,
                playbackState: "playing",
                currentPlaybackRate: playbackRate,
            });
            if (decision.kind === "rate") playbackRate = decision.playbackRate;
            if (decision.kind === "seek") actualPosition = decision.positionSeconds;
        }

        expect(Math.abs(600 - actualPosition)).toBeLessThan(0.25);
    });

    it("moduł nie importuje DOM ani odtwarzacza", () => {
        const source = readFileSync(resolve(__dirname, "../driftCorrection.ts"), "utf8");

        expect(source).not.toMatch(/document|window|HTMLVideoElement|VideoPlayer|vidstack/u);
    });
});
