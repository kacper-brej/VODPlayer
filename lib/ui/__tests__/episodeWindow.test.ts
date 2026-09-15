import { describe, expect, it } from "vitest";
import {
    EPISODE_WINDOW_THRESHOLD,
    episodeColumns,
    estimateEpisodeRowHeight,
    findVisibleEpisodeRow,
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

    it("finds a partially visible row near the end without measuring every episode", () => {
        let reads = 0;
        const row = findVisibleEpisodeRow(1000, (index) => {
            reads += 1;
            return { top: index * 150, bottom: index * 150 + 130 };
        }, 149260, 150000);

        expect(row).toBe(995);
        expect(reads).toBeLessThanOrEqual(11);
    });

    it("skips rows ending at the viewport edge and handles unequal row heights", () => {
        const bounds = [{ top: 0, bottom: 100 }, { top: 116, bottom: 390 }, { top: 406, bottom: 500 }];
        expect(findVisibleEpisodeRow(bounds.length, (index) => bounds[index], 100, 300)).toBe(1);
        expect(findVisibleEpisodeRow(bounds.length, (index) => bounds[index], 390, 406)).toBeNull();
    });

    it("returns no anchor when the episode list is outside the viewport or empty", () => {
        const readBounds = (index: number) => ({ top: 1000 + index * 150, bottom: 1130 + index * 150 });
        expect(findVisibleEpisodeRow(100, readBounds, 0, 800)).toBeNull();
        expect(findVisibleEpisodeRow(100, readBounds, 20000, 21000)).toBeNull();
        expect(findVisibleEpisodeRow(0, readBounds, 0, 800)).toBeNull();
    });
});
