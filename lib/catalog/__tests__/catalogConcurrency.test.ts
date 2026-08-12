import { describe, expect, it, vi } from "vitest";
import { loadCatalogRows } from "../catalogRepository";

describe("rownoletosc katalogu", () => {
    it("nie wykonuje wiecej niz dwoch zapytan jednoczesnie", async () => {
        let active = 0;
        let maximum = 0;
        const execute = vi.fn(async () => {
            active += 1;
            maximum = Math.max(maximum, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active -= 1;
            return [[]];
        });
        await loadCatalogRows({ execute } as never);
        expect(maximum).toBe(2);
    });
});
