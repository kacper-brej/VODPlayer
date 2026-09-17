import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaPlayerInstance } from "@vidstack/react";

const mocks = vi.hoisted(() => ({ effects: [] as Array<() => (() => void) | undefined>, report: vi.fn(), flush: vi.fn() }));
vi.mock("react", () => ({ useEffect: (effect: () => (() => void) | undefined) => { mocks.effects.push(effect); } }));
vi.mock("../client", () => ({ consumeWatchIntent: () => undefined, flushPerformanceSamples: mocks.flush, performanceSamplingEnabled: () => true, reportPerformanceSample: mocks.report }));
import { usePlaybackMeasurements } from "../usePlaybackMeasurements";

afterEach(() => { mocks.effects = []; vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("playback measurement integration", () => {
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
