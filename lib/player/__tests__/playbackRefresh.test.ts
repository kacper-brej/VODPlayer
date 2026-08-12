import { describe, expect, it } from "vitest";
import {
    HLS_REFRESH_BACKOFF_MS,
    HLS_REFRESH_MAX_ATTEMPTS,
    playbackRefreshSnapshot,
    shouldRefreshHlsAccess,
} from "../playbackRefresh";

describe("odswiezanie dostepu HLS", () => {
    it("zachowuje pozycje, pauze i recznie wybrana jakosc", () => {
        expect(playbackRefreshSnapshot(321.5, true, 720)).toEqual({
            positionSeconds: 321.5,
            paused: true,
            qualityHeight: 720,
        });
    });

    it("normalizuje nieprawidlowa pozycje i jakosc", () => {
        expect(playbackRefreshSnapshot(Number.NaN, false, -1)).toEqual({
            positionSeconds: 0,
            paused: false,
            qualityHeight: null,
        });
    });

    it("odswieza tylko fatalne 403/410 i ma ograniczone proby z backoffem", () => {
        expect(shouldRefreshHlsAccess(true, 403, 0)).toBe(true);
        expect(shouldRefreshHlsAccess(true, 410, 2)).toBe(true);
        expect(shouldRefreshHlsAccess(true, 500, 0)).toBe(false);
        expect(shouldRefreshHlsAccess(false, 403, 0)).toBe(false);
        expect(shouldRefreshHlsAccess(true, 403, HLS_REFRESH_MAX_ATTEMPTS)).toBe(false);
        expect(HLS_REFRESH_BACKOFF_MS).toEqual([0, 400, 1200]);
    });
});
