import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaPlayerInstance } from "@vidstack/react";

const mocks = vi.hoisted(() => ({ effects: [] as Array<() => (() => void) | undefined>, report: vi.fn(), flush: vi.fn() }));
vi.mock("react", () => ({ useEffect: (effect: () => (() => void) | undefined) => { mocks.effects.push(effect); } }));
vi.mock("../client", () => ({ consumeWatchIntent: () => undefined, flushPerformanceSamples: mocks.flush, performanceSamplingEnabled: () => true, reportPerformanceSample: mocks.report }));
import { usePlaybackMeasurements } from "../usePlaybackMeasurements";
import { createEpisodeSwitchMeasurement } from "../episodeSwitchMeasurements";

afterEach(() => { mocks.effects = []; vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("playback measurement integration", () => {
    it("ends an episode switch on the video frame, including the preceding API wait", () => {
        let time = 100;
        let onFrame!: () => void;
        const episodeReport = vi.fn();
        const measurement = createEpisodeSwitchMeasurement("hls", episodeReport, () => time);
        time = 400;
        measurement.dataReady("hls", true);
        const player = Object.assign(new EventTarget(), {
            paused: false, state: { seeking: false },
            el: { querySelector: () => ({ requestVideoFrameCallback: (callback: () => void) => { onFrame = callback; return 1; }, cancelVideoFrameCallback: vi.fn() }) },
        });
        vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
        const Harness = () => { usePlaybackMeasurements({ current: player as unknown as MediaPlayerInstance }, "next-episode", "hls", false, measurement); return null; };
        Harness();
        const cleanup = mocks.effects[0]();
        player.dispatchEvent(new Event("playing"));
        expect(episodeReport).toHaveBeenCalledTimes(1);
        time = 900; onFrame();
        expect(episodeReport).toHaveBeenLastCalledWith(expect.objectContaining({ name: "PLAYER_EPISODE_SWITCH", value: 800, load: "prefetched" }));
        expect(mocks.report).not.toHaveBeenCalledWith(expect.objectContaining({ name: "PLAYER_STARTUP" }));
        cleanup!();
    });

    it.each(["pause", "auto-play-fail", "error", "hidden", "unmount"])("excludes %s during switching from successful-switch timing", (event) => {
        const episodeReport = vi.fn();
        const measurement = createEpisodeSwitchMeasurement("hls", episodeReport, () => 0);
        measurement.dataReady("hls", false);
        const player = Object.assign(new EventTarget(), { paused: false, state: { seeking: false }, el: { querySelector: () => null } });
        const documentTarget = Object.assign(new EventTarget(), { visibilityState: "visible" });
        vi.stubGlobal("document", documentTarget);
        const Harness = () => { usePlaybackMeasurements({ current: player as unknown as MediaPlayerInstance }, "next", "hls", false, measurement); return null; };
        Harness();
        const cleanup = mocks.effects[0]();
        if (event === "unmount") cleanup!();
        else if (event === "hidden") {
            documentTarget.visibilityState = "hidden";
            documentTarget.dispatchEvent(new Event("visibilitychange"));
        } else player.dispatchEvent(new Event(event));
        player.dispatchEvent(new Event("playing"));
        expect(episodeReport).toHaveBeenCalledTimes(1);
        if (event !== "unmount") cleanup!();
    });

    it("uses the player's element for first-frame timing and removes all listeners on exit", () => {
        let onFrame: (() => void) | undefined;
        const cancel = vi.fn();
        const player = Object.assign(new EventTarget(), {
            paused: false,
            state: { seeking: false },
            el: { querySelector: () => ({ requestVideoFrameCallback: (callback: () => void) => { onFrame = callback; return 1; }, cancelVideoFrameCallback: cancel }) },
        });
        const documentTarget = Object.assign(new EventTarget(), { visibilityState: "visible" });
        vi.stubGlobal("document", documentTarget);
        const Harness = () => { usePlaybackMeasurements({ current: player as unknown as MediaPlayerInstance }, "episode", "file", false); return null; };
        Harness();
        const cleanup = mocks.effects[0]();
        player.dispatchEvent(new Event("playing"));
        expect(mocks.report).not.toHaveBeenCalled();
        onFrame!();
        expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ name: "PLAYER_STARTUP", delivery: "file" }));
        player.dispatchEvent(new Event("playing"));
        cleanup!();
        expect(cancel).toHaveBeenCalledWith(1);
        const count = mocks.report.mock.calls.length;
        player.dispatchEvent(new Event("error"));
        expect(mocks.report).toHaveBeenCalledTimes(count);
        expect(mocks.flush).toHaveBeenCalledOnce();
    });

    it("leaves watch-party measurements to the existing telemetry", () => {
        const player = new EventTarget();
        const add = vi.spyOn(player, "addEventListener");
        const Harness = () => { usePlaybackMeasurements({ current: player as unknown as MediaPlayerInstance }, "episode", "hls", true); return null; };
        Harness();
        expect(mocks.effects[0]()).toBeUndefined();
        expect(add).not.toHaveBeenCalled();
    });
});
