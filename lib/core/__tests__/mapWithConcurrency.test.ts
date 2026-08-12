import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../mapWithConcurrency";

describe("mapWithConcurrency", () => {
    it("zachowuje kolejność i nie przekracza limitu", async () => {
        let active = 0;
        let maximum = 0;
        const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
            active += 1;
            maximum = Math.max(maximum, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active -= 1;
            return value * 2;
        });
        expect(result).toEqual([2, 4, 6, 8, 10]);
        expect(maximum).toBe(2);
    });
});
