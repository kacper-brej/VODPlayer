import { afterEach, describe, expect, it, vi } from "vitest";
import { createEpisodeSwitchMeasurement } from "../episodeSwitchMeasurements";

afterEach(() => vi.restoreAllMocks());

describe("episode switching measurements", () => {
    it.each([false, true])("includes data loading in first-frame timing, prefetched=%s", (prefetched) => {
        let time = 100;
        const report = vi.fn();
        const measurement = createEpisodeSwitchMeasurement("file", report, () => time);
        time = 350;
        measurement.dataReady("hls", prefetched);
        measurement.dataReady("file", !prefetched);
        time = 800;
        measurement.firstFrame();
        measurement.firstFrame();
        const load = prefetched ? "prefetched" : "network";
        expect(report.mock.calls.map(([sample]) => sample)).toEqual([
            { id: expect.any(String), name: "PLAYER_EPISODE_DATA", value: 250, delivery: "hls", load },
            { id: expect.any(String), name: "PLAYER_EPISODE_SWITCH", value: 700, delivery: "hls", load },
        ]);
        expect(report.mock.calls[0][0].id).toBe(report.mock.calls[1][0].id);
    });
    it("reports one failed data load, never a successful switch", () => {
        const report = vi.fn();
        const measurement = createEpisodeSwitchMeasurement("hls", report, () => 0);
        measurement.failData(); measurement.failData();
        measurement.dataReady("hls", false); measurement.firstFrame();
        expect(report).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: "PLAYER_EPISODE_ERROR", value: 1 }));
    });
    it("does not report abandoned/hidden attempts or a frame before data was ready", () => {
        const report = vi.fn();
        const measurement = createEpisodeSwitchMeasurement("hls", report, () => 0);
        measurement.firstFrame();
        expect(report).not.toHaveBeenCalled();
        measurement.cancel();
        measurement.dataReady("hls", true); measurement.firstFrame(); measurement.failData();
        expect(report).not.toHaveBeenCalled();
    });
    it("keeps an already measured data load but excludes a cancelled first-frame wait", () => {
        const report = vi.fn();
        const measurement = createEpisodeSwitchMeasurement("hls", report, () => 0);
        measurement.dataReady("hls", false);
        measurement.cancel(); measurement.firstFrame(); measurement.failData();
        expect(report).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: "PLAYER_EPISODE_DATA" }));
    });
    it("does not mix retries or unrelated episode attempts", () => {
        const report = vi.fn();
        const first = createEpisodeSwitchMeasurement("hls", report, () => 0);
        const second = createEpisodeSwitchMeasurement("file", report, () => 0);
        first.cancel(); first.dataReady("hls", true); first.firstFrame();
        second.dataReady("file", false); second.firstFrame();
        expect(report).toHaveBeenCalledTimes(2);
        expect(report.mock.calls.every(([sample]) => sample.delivery === "file")).toBe(true);
    });
    it("does not interrupt playback when the reporting transport fails", () => {
        const report = vi.fn(() => { throw new Error("telemetry unavailable"); });
        const measurement = createEpisodeSwitchMeasurement("file", report, () => 0);
        expect(() => { measurement.dataReady("file", true); measurement.firstFrame(); }).not.toThrow();
    });
});
