import { describe, expect, it, vi } from "vitest";
import { createPlaybackMeasurements } from "../playbackMeasurements";
import { createPerformanceStore } from "../store";
import { parsePerformanceBatch, pageGroup, type PerformanceSample } from "../contracts";

const sample = (overrides: Partial<PerformanceSample> = {}): PerformanceSample => ({ id: "visit-1", name: "LCP", value: 2000, page: "home", device: "mobile", delivery: "page", ...overrides });

describe("performance reports", () => {
    it("accepts finite bounded metrics and removes unrecognized fields", () => {
        expect(parsePerformanceBatch([{ ...sample(), url: "private", userId: 42 }])).toEqual([sample()]);
        expect(pageGroup("/series/private-series")).toBe("series");
    });

    it.each([NaN, Infinity, -1, 600001, "10"])("rejects invalid values: %s", (value) => {
        expect(parsePerformanceBatch([{ ...sample(), value }])).toBeNull();
    });

    it("rejects oversized batches, unknown groups and mismatched player metrics", () => {
        expect(parsePerformanceBatch(Array.from({ length: 21 }, () => sample()))).toBeNull();
        expect(parsePerformanceBatch([sample({ page: "private" as "home" })])).toBeNull();
        expect(parsePerformanceBatch([sample({ name: "PLAYER_STARTUP" })])).toBeNull();
        expect(parsePerformanceBatch([sample({ name: "PLAYER_ERROR", page: "watch", delivery: "file", value: 4 })])).toBeNull();
    });

    it("updates an existing Web Vital without counting the same visit twice", () => {
        const store = createPerformanceStore(() => 100);
        store.record([sample(), sample({ id: "visit-2", value: 1000 })]);
        store.record([sample({ value: 3000 })]);
        expect(store.snapshot().rows[0]).toMatchObject({ count: 2, p50: 1000, p75: 3000, p95: 3000 });
    });

    it("bounds retained samples, splits delivery types and removes expired samples", () => {
        let time = 0;
        const store = createPerformanceStore(() => time);
        store.record(Array.from({ length: 600 }, (_, index) => sample({ id: `visit-${index}`, value: index })));
        store.record([sample({ name: "PLAYER_STARTUP", page: "watch", delivery: "hls" })]);
        expect(store.snapshot().rows.map((row) => row.count)).toEqual([512, 1]);
        time = 24 * 60 * 60 * 1000 + 1;
        expect(store.snapshot().rows).toEqual([]);
    });

    it("limits report batches per authenticated user and resets the window", () => {
        let time = 0;
        const store = createPerformanceStore(() => time);
        for (let index = 0; index < 12; index += 1) expect(store.acceptReporter(1)).toBe(true);
        expect(store.acceptReporter(1)).toBe(false);
        expect(store.acceptReporter(2)).toBe(true);
        time = 60001;
        expect(store.acceptReporter(1)).toBe(true);
    });
});

describe("playback measurements", () => {
    it("measures intent to first frame and deduplicates repeated playing and waiting events", () => {
        let time = 100;
        const report = vi.fn();
        const tracker = createPlaybackMeasurements(report, () => time);
        tracker.requestPlay(0);
        tracker.waiting();
        time = 500;
        tracker.firstFrame();
        tracker.firstFrame();
        time = 1000;
        tracker.waiting();
        time = 1100;
        tracker.waiting();
        time = 1400;
        tracker.firstFrame();
        expect(report.mock.calls).toEqual([["PLAYER_STARTUP", 500], ["PLAYER_BUFFER", 400]]);
    });

    it("excludes autoplay permission waiting, pause, seek and hidden-tab time from buffering", () => {
        let time = 0;
        const report = vi.fn();
        const tracker = createPlaybackMeasurements(report, () => time);
        tracker.requestPlay();
        tracker.pause();
        time = 20000;
        tracker.requestPlay();
        time = 20100;
        tracker.firstFrame();
        tracker.seeking();
        tracker.waiting();
        time = 20200;
        tracker.seeked();
        tracker.pause();
        tracker.waiting();
        tracker.firstFrame();
        tracker.waiting();
        tracker.visibility(false);
        time = 90000;
        tracker.visibility(true);
        tracker.firstFrame();
        expect(report.mock.calls).toEqual([["PLAYER_STARTUP", 100], ["PLAYER_SEEK", 100]]);
    });

    it("deduplicates error events until playback recovers and ignores abandoned attempts", () => {
        const report = vi.fn();
        const tracker = createPlaybackMeasurements(report, () => 0);
        tracker.requestPlay();
        tracker.error();
        tracker.error();
        tracker.firstFrame();
        tracker.error();
        tracker.dispose();
        expect(report.mock.calls).toEqual([["PLAYER_ERROR", 1], ["PLAYER_ERROR", 1]]);
    });
});
