import { describe, expect, it } from "vitest";
import { getContentRowActiveIndex, getContentRowWindow, isContentRowItemMounted } from "../contentRowWindow";

describe("content row window", () => {
    it("keeps short rows complete and bounds the initial render of a long row", () => {
        expect(getContentRowWindow(0, 0, 0, 0)).toEqual({ start: 0, end: 0 });
        expect(getContentRowWindow(24, 0, 0, 0)).toEqual({ start: 0, end: 24 });
        expect(getContentRowWindow(200, 0, 0, 0)).toEqual({ start: 0, end: 12 });
    });

    it("covers partially visible cards and a full viewport of overscan on each side", () => {
        expect(getContentRowWindow(200, 1058, 1000, 200, 8)).toEqual({ start: 0, end: 16 });
        expect(getContentRowWindow(200, 10058, 1000, 200, 8)).toEqual({ start: 45, end: 61 });
    });

    it("keeps a useful buffer on narrow screens and includes the final title", () => {
        expect(getContentRowWindow(200, 2908, 390, 290, 8)).toEqual({ start: 7, end: 15 });
        const lastWindow = getContentRowWindow(200, 57618, 390, 290, 8);

        expect(lastWindow).toEqual({ start: 195, end: 200 });
        expect(isContentRowItemMounted(199, lastWindow, 0)).toBe(true);
    });

    it("does not lose the focused card when the user scrolls far away", () => {
        const window = getContentRowWindow(200, 10058, 1000, 200, 8);
        const mounted = Array.from({ length: 200 }, (_, index) => index)
            .filter((index) => isContentRowItemMounted(index, window, 2));

        expect(mounted).toContain(2);
        expect(mounted).toContain(50);
        expect(mounted).not.toContain(3);
        expect(mounted).toHaveLength(17);
    });

    it("recalculates coverage after resizing and clamps elastic overscroll", () => {
        expect(getContentRowWindow(200, -100, 1000, 200, 8)).toEqual({ start: 0, end: 10 });
        expect(getContentRowWindow(200, 10058, 1600, 320, 8)).toEqual({ start: 26, end: 42 });
        expect(getContentRowWindow(200, 100000, 1000, 200, 8)).toEqual({ start: 194, end: 200 });
    });

    it("keeps the focused title mounted after an earlier item is removed or inserted", () => {
        const keys = Array.from({ length: 200 }, (_, index) => `title-${index}`);
        const afterRemoval = keys.filter((key) => key !== "title-10");
        const afterInsertion = ["new-title", ...keys];
        const scrolledAway = getContentRowWindow(200, 0, 390, 290, 8);
        const movedLeft = getContentRowActiveIndex(afterRemoval, 150, "title-150");
        const movedRight = getContentRowActiveIndex(afterInsertion, 150, "title-150");

        expect(movedLeft).toBe(149);
        expect(movedRight).toBe(151);
        expect(isContentRowItemMounted(149, scrolledAway, movedLeft)).toBe(true);
        expect(isContentRowItemMounted(151, scrolledAway, movedRight)).toBe(true);
        expect(isContentRowItemMounted(150, scrolledAway, movedLeft)).toBe(false);
    });

    it("keeps a valid full card as the tab stop when the active title disappears", () => {
        const keys = ["title-0", "title-1", "title-2"];
        const index = getContentRowActiveIndex(keys, 199, "title-199");

        expect(index).toBe(2);
        expect(isContentRowItemMounted(index, { start: 194, end: 200 }, index)).toBe(true);
        expect(getContentRowActiveIndex([], 199, "title-199")).toBe(-1);
        expect(getContentRowActiveIndex(keys, -1, null)).toBe(0);
    });
});
