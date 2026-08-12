import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionExecute = vi.fn();
const poolExecute = vi.fn();

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: (work: (connection: { execute: typeof transactionExecute }) => unknown) =>
        work({ execute: transactionExecute }),
}));
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute: poolExecute }) }));

const { findArtworkStorageKey, replaceManualArtworkRecord } = await import("../artworkRepository");

beforeEach(() => {
    transactionExecute.mockReset();
    poolExecute.mockReset();
});

describe("replaceManualArtworkRecord", () => {
    it("nie zapisuje grafiki dla nieznanej serii", async () => {
        transactionExecute.mockResolvedValueOnce([[]]);

        await expect(replaceManualArtworkRecord({
            seriesKey: "Test",
            kind: "poster",
            storageKey: "artwork/Test/poster/123.webp",
            width: 600,
            height: 900,
            dominantColor: "#112233",
            placeholder: "data:image/jpeg;base64,eA==",
        })).resolves.toBeNull();
        expect(transactionExecute).toHaveBeenCalledOnce();
    });

    it("atomowo publikuje nowy rekord i usuwa zastapione rekordy manualne", async () => {
        transactionExecute
            .mockResolvedValueOnce([[{ series_key: "Test" }]])
            .mockResolvedValueOnce([[
                { id: 2, storage_key: "artwork/Test/poster/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp" },
                { id: 3, storage_key: null },
            ]])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{ insertId: 7 }])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{}]);

        const result = await replaceManualArtworkRecord({
            seriesKey: "Test",
            kind: "poster",
            storageKey: "artwork/Test/poster/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp",
            width: 600,
            height: 900,
            dominantColor: "#112233",
            placeholder: "data:image/jpeg;base64,eA==",
        });

        expect(result).toEqual({
            id: 7,
            url: "/api/artwork?id=7",
            replacedStorageKeys: ["artwork/Test/poster/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp"],
        });
        expect(transactionExecute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO series_artwork[\s\S]*storage_key/),
            expect.arrayContaining(["Test", "poster", 600, 900, "#112233"]),
        );
        expect(transactionExecute).toHaveBeenCalledWith(
            "UPDATE series_artwork SET url = ? WHERE id = ?",
            ["/api/artwork?id=7", 7],
        );
        expect(transactionExecute).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM series_artwork[\s\S]*id <> \?/),
            ["Test", "poster", 7],
        );
    });
});

describe("findArtworkStorageKey", () => {
    it("zwraca stabilny klucz zamiast URL-a z bazy", async () => {
        poolExecute.mockResolvedValueOnce([[{ storage_key: "artwork/Test/poster/id.webp" }]]);
        await expect(findArtworkStorageKey(7)).resolves.toBe("artwork/Test/poster/id.webp");
        expect(poolExecute).toHaveBeenCalledWith(expect.stringMatching(/storage_key IS NOT NULL/), [7]);
    });
});
