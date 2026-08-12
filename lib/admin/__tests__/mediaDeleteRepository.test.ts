import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/transaction", () => ({
    withTransaction: (work: (connection: { execute: typeof execute }) => unknown) => work({ execute }),
}));

const { beginMediaDeletion, finalizeMediaDeletion } = await import("../mediaDeleteRepository");

beforeEach(() => execute.mockReset());

describe("mediaDeleteRepository", () => {
    it("claim ustawia deleting przed zwróceniem prefixu z DB", async () => {
        execute.mockResolvedValueOnce([[
            { id: 7, status: "ready", storage_prefix: "media/Test/01.mp4", lease_active: 0 },
        ]]).mockResolvedValueOnce([{}]);
        await expect(beginMediaDeletion("Test", "01.mp4", {} as never)).resolves.toEqual({
            kind: "claimed",
            assetId: 7,
            storagePrefix: "media/Test/01.mp4",
        });
        expect(execute).toHaveBeenNthCalledWith(1, expect.stringMatching(/FOR UPDATE/), ["Test", "01.mp4"]);
        expect(execute).toHaveBeenNthCalledWith(2, expect.stringMatching(/status = 'deleting'/), [7]);
    });

    it("drugi delete podczas aktywnej dzierżawy nie otrzymuje claimu", async () => {
        execute.mockResolvedValueOnce([[
            { id: 7, status: "deleting", storage_prefix: "media/Test/01.mp4", lease_active: 1 },
        ]]);
        await expect(beginMediaDeletion("Test", "01.mp4", {} as never)).resolves.toEqual({
            kind: "in_progress",
            assetId: 7,
        });
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("finalizacja i usunięcie renditionów należą do jednej transakcji", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{}]);
        await expect(finalizeMediaDeletion(7, {} as never)).resolves.toBe(true);
        expect(execute).toHaveBeenNthCalledWith(1, expect.stringMatching(/status = 'deleted'/), [7]);
        expect(execute).toHaveBeenNthCalledWith(2, expect.stringContaining("DELETE FROM media_renditions"), [7]);
    });
});
