import { describe, expect, it } from "vitest";
import {
    EPISODE_WINDOW_THRESHOLD,
    episodeColumns,
    estimateEpisodeRowHeight,
    getMountedEpisodeRows,
} from "../episodeWindow";

describe("episode list window", () => {
    it("keeps only the initial rows mounted before visibility is known", () => {
        expect([...getMountedEpisodeRows(100, null, null)]).toEqual([0, 1, 2, 3, 4, 5]);
        expect(EPISODE_WINDOW_THRESHOLD).toBeGreaterThan(24);
    });

    it("mounts visible rows with bounded overscan", () => {
        expect([...getMountedEpisodeRows(100, [20, 21], null)]).toEqual([18, 19, 20, 21, 22, 23]);
    });

    it("always mounts a focused row outside the visible range", () => {
        expect([...getMountedEpisodeRows(100, [4], 80)]).toEqual([2, 3, 4, 5, 6, 80]);
    });

    it("uses the same responsive column breakpoints as the episode grid", () => {
        expect([episodeColumns(390), episodeColumns(1024), episodeColumns(1280)]).toEqual([1, 2, 3]);
        expect(estimateEpisodeRowHeight(360, 1, 16)).toBeGreaterThan(300);
    });
});
