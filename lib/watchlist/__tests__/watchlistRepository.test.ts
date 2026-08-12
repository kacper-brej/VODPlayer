import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { listWatchlistForProfile, upsertWatchlistItem, deleteWatchlistItem } = await import("../watchlistRepository");

beforeEach(() => execute.mockReset());

describe("listWatchlistForProfile", () => {
    it("sortuje po added_at malejaco w samym SQL", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listWatchlistForProfile(5);
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY added_at DESC/), [5]);
    });

    it("mapuje wiersze na seriesKey/addedAt", async () => {
        execute.mockResolvedValueOnce([[{ series_key: "Naruto", added_at: 1000 }]]);
        await expect(listWatchlistForProfile(5)).resolves.toEqual([{ seriesKey: "Naruto", addedAt: 1000 }]);
    });
});

describe("upsertWatchlistItem", () => {
    it("uzywa ON DUPLICATE KEY UPDATE po unikalnym (profile_id, series_key)", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertWatchlistItem(5, "Naruto");
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/ON DUPLICATE KEY UPDATE/),
            [5, "Naruto"],
        );
    });
});

describe("deleteWatchlistItem", () => {
    it("usuwa po (profile_id, series_key) razem, nie samym series_key", async () => {
        execute.mockResolvedValueOnce([{}]);
        await deleteWatchlistItem(5, "Naruto");
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/WHERE profile_id = \? AND series_key = \?/),
            [5, "Naruto"],
        );
    });
});
