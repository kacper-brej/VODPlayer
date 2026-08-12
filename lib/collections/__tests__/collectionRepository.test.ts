import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const {
    listCollectionsForProfile,
    countCollectionsForProfile,
    isCollectionOwnedByProfile,
    insertCollection,
    upsertCollectionItem,
    deleteCollectionItemsByCollectionId,
    deleteCollectionById,
} = await import("../collectionRepository");

beforeEach(() => execute.mockReset());

describe("listCollectionsForProfile", () => {
    it("LEFT JOIN + COUNT dla item_count, sortowanie po created_at malejaco w SQL", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listCollectionsForProfile(5);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/LEFT JOIN collection_items[\s\S]*ORDER BY c\.created_at DESC/),
            [5],
        );
    });
});

describe("isCollectionOwnedByProfile", () => {
    it("WHERE id=? AND profile_id=? — sprawdzenie wlasnosci w samym SQL, nie w JS", async () => {
        execute.mockResolvedValueOnce([[{ id: 1 }]]);
        await isCollectionOwnedByProfile(1, 5);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/WHERE id = \? AND profile_id = \?/),
            [1, 5],
        );
    });

    it("brak wiersza -> false", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(isCollectionOwnedByProfile(1, 5)).resolves.toBe(false);
    });
});

describe("countCollectionsForProfile", () => {
    it("zwraca liczbe z pierwszego wiersza", async () => {
        execute.mockResolvedValueOnce([[{ count: 3 }]]);
        await expect(countCollectionsForProfile(5)).resolves.toBe(3);
    });
});

describe("insertCollection", () => {
    it("zwraca insertId z ResultSetHeader", async () => {
        execute.mockResolvedValueOnce([{ insertId: 42 }]);
        await expect(insertCollection(5, "Ulubione")).resolves.toBe(42);
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO collections/), [5, "Ulubione"]);
    });
});

describe("upsertCollectionItem", () => {
    it("uzywa ON DUPLICATE KEY UPDATE po unikalnym (collection_id, series_key)", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertCollectionItem(1, "Naruto");
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/ON DUPLICATE KEY UPDATE/),
            [1, "Naruto"],
        );
    });
});

describe("delete kolekcji — funkcje transakcyjne przyjmuja polaczenie wprost, nie pool", () => {
    it("deleteCollectionItemsByCollectionId wywoluje execute na przekazanym polaczeniu", async () => {
        const connectionExecute = vi.fn().mockResolvedValueOnce([{}]);
        const connection = { execute: connectionExecute } as never;

        await deleteCollectionItemsByCollectionId(1, connection);

        expect(connectionExecute).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM collection_items WHERE collection_id = \?/),
            [1],
        );
        expect(execute).not.toHaveBeenCalled();
    });

    it("deleteCollectionById wywoluje execute na przekazanym polaczeniu", async () => {
        const connectionExecute = vi.fn().mockResolvedValueOnce([{}]);
        const connection = { execute: connectionExecute } as never;

        await deleteCollectionById(1, connection);

        expect(connectionExecute).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM collections WHERE id = \?/),
            [1],
        );
        expect(execute).not.toHaveBeenCalled();
    });
});
