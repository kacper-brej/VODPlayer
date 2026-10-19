import { describe, expect, it, vi } from "vitest";
import { reuseRequestRead, withRequestReadScope } from "../requestReadScope";

describe("request-scoped read reuse", () => {
    it("coalesces concurrent reads only inside the same scope", async () => {
        const read = vi.fn(async () => ({ userId: 1 }));
        await withRequestReadScope(async () => {
            const [a, b] = await Promise.all([reuseRequestRead("user", read), reuseRequestRead("user", read)]);
            expect(a).toBe(b);
        });
        expect(read).toHaveBeenCalledTimes(1);
        await withRequestReadScope(() => reuseRequestRead("user", read));
        expect(read).toHaveBeenCalledTimes(2);
    });
    it("never shares viewers between overlapping requests", async () => {
        const first = vi.fn(async () => { await Promise.resolve(); return 1; });
        const second = vi.fn(async () => { await Promise.resolve(); return 2; });
        const read = (source: () => Promise<number>) => withRequestReadScope(async () => {
            const a = reuseRequestRead("user", source);
            await Promise.resolve();
            return [await a, await reuseRequestRead("user", source)];
        });
        expect(await Promise.all([read(first), read(second)])).toEqual([[1, 1], [2, 2]]);
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });
    it("does not retain errors or results for later requests", async () => {
        const read = vi.fn().mockRejectedValueOnce(new Error("database")).mockResolvedValue(2);
        await expect(withRequestReadScope(() => reuseRequestRead("user", read))).rejects.toThrow("database");
        expect(await withRequestReadScope(() => reuseRequestRead("user", read))).toBe(2);
    });
    it("does not change reads outside a scope", async () => {
        const read = vi.fn(async () => 1);
        await reuseRequestRead("user", read);
        await reuseRequestRead("user", read);
        expect(read).toHaveBeenCalledTimes(2);
    });
});
