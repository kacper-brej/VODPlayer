import { describe, expect, it, vi } from "vitest";
import {
    applyPartyAnchor,
    applyPartyCorrection,
} from "../partyPlayerAdapter";
import { requestPlaybackToggle } from "@/lib/player/controlledPlayback";

const player = () => ({
    currentTime: 10,
    playbackRate: 1,
    paused: true,
    play: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
});

describe("partyPlayerAdapter", () => {
    it("nie ustawia currentTime dla korekty poniżej progu", () => {
        const target = player();
        expect(applyPartyCorrection(target, { kind: "none" }, true, false)).toBe(false);
        expect(target.currentTime).toBe(10);
        expect(applyPartyCorrection(target, { kind: "rate", playbackRate: 1.03 }, true, false)).toBe(true);
        expect(target.currentTime).toBe(10);
        expect(applyPartyCorrection(target, { kind: "rate", playbackRate: 1 }, true, false)).toBe(true);
        expect(target.playbackRate).toBe(1);
    });

    it("wysyła intencję spacji bez lokalnej zmiany odtwarzacza", async () => {
        const target = player();
        const sendIntent = vi.fn(async () => null);
        await requestPlaybackToggle(target, sendIntent);
        expect(sendIntent).toHaveBeenCalledWith({ kind: "play" });
        expect(target.play).not.toHaveBeenCalled();
        expect(target.pause).not.toHaveBeenCalled();
    });

    it("bez synchronizacji używa wyłącznie lokalnego odtwarzacza", async () => {
        const target = player();
        await requestPlaybackToggle(target);
        expect(target.play).toHaveBeenCalledOnce();
    });

    it("odrzucone zdalne play wymaga gestu", async () => {
        const target = player();
        target.play.mockRejectedValueOnce(new Error("autoplay"));
        await expect(applyPartyAnchor(target, "playing", () => 24)).resolves.toBe("gesture-required");
        expect(target.currentTime).toBe(24);
    });
});
