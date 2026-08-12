import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    clockSampleOffsetMs,
    estimateClockOffset,
    serverNowFromClientClock,
    type ClockSample,
} from "../clockSync";

const sample = (sentAtMs: number, rttMs: number, offsetMs: number): ClockSample => ({
    clientSentAtMs: sentAtMs,
    serverNowMs: sentAtMs + rttMs / 2 + offsetMs,
    clientReceivedAtMs: sentAtMs + rttMs,
});

describe("synchronizacja zegara", () => {
    it("koryguje czas serwera o połowę RTT", () => {
        expect(clockSampleOffsetMs(sample(1000, 40, 5000))).toBe(5000);
    });

    it("odrzuca rażący outlier RTT i bierze medianę pozostałych offsetów", () => {
        const estimate = estimateClockOffset([
            sample(1000, 20, 5000),
            sample(2000, 24, 5001),
            sample(3000, 18, 4999),
            sample(4000, 22, 5000),
            sample(5000, 1000, 5600),
        ]);

        expect(estimate).toEqual({
            offsetMs: 5000,
            medianRttMs: 21,
            samplesUsed: 4,
            samplesDiscarded: 1,
        });
    });

    it("nie ufa jednej ani dwóm próbkom", () => {
        expect(estimateClockOffset([sample(1000, 20, 5000)])).toBeNull();
        expect(estimateClockOffset([sample(1000, 20, 5000), sample(2000, 20, 5000)])).toBeNull();
    });

    it("przelicza lokalny Date.now na oś czasu serwera", () => {
        expect(serverNowFromClientClock(10_000, -350)).toBe(9650);
    });

    it("moduł obliczeniowy nie importuje DOM ani Reacta", () => {
        const source = readFileSync(resolve(__dirname, "../clockSync.ts"), "utf8");

        expect(source).not.toMatch(/document|window|HTMLElement|react/u);
    });
});
