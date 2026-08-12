import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

const processArtwork = vi.fn();
const replaceManualArtworkRecord = vi.fn();
const findArtworkStorageKey = vi.fn();
const putArtworkObject = vi.fn();
const deleteArtworkObject = vi.fn();
const presignArtworkObject = vi.fn();

vi.mock("@/lib/artwork/artworkProcessor", () => ({
    ArtworkProcessingError: class ArtworkProcessingError extends Error {},
    processArtwork,
}));
vi.mock("@/lib/artwork/artworkRepository", () => ({
    replaceManualArtworkRecord,
    findArtworkStorageKey,
}));
vi.mock("@/lib/artwork/artworkStorage", () => ({
    ArtworkStorageConfigError: class ArtworkStorageConfigError extends Error {},
    putArtworkObject,
    deleteArtworkObject,
    presignArtworkObject,
    isArtworkStorageKey: (value: string) => /^artwork\/[^/]+\/(poster|backdrop|logo)\/[0-9a-f-]{36}\.webp$/i.test(value),
}));

const { buildArtworkRedirect, saveManualArtwork } = await import("../artworkService");

const processedPoster = {
    data: Buffer.from("webp"),
    format: "webp",
    mimeType: "image/webp",
    width: 600,
    height: 900,
    dominantColor: "#112233",
    placeholder: "data:image/jpeg;base64,eA==",
};

beforeEach(() => {
    vi.clearAllMocks();
    processArtwork.mockResolvedValue(processedPoster);
    putArtworkObject.mockResolvedValue(undefined);
    deleteArtworkObject.mockResolvedValue(undefined);
});

describe("saveManualArtwork", () => {
    it("zapisuje nowe B2 i DB przed usunieciem poprzedniego obiektu", async () => {
        const oldKey = "artwork/Test/poster/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";
        replaceManualArtworkRecord.mockResolvedValue({
            id: 9,
            url: "/api/artwork?id=9",
            replacedStorageKeys: [oldKey],
        });

        const result = await saveManualArtwork("Test", "poster", Buffer.from("input"));

        expect(result).toEqual({ ok: true, id: 9, url: "/api/artwork?id=9" });
        const newKey = putArtworkObject.mock.calls[0]?.[0] as string;
        expect(newKey).toMatch(/^artwork\/Test\/poster\/[0-9a-f-]{36}\.webp$/);
        expect(processArtwork).toHaveBeenCalledWith(expect.any(Buffer), { normalizeToWebp: true });
        expect(putArtworkObject.mock.invocationCallOrder[0])
            .toBeLessThan(replaceManualArtworkRecord.mock.invocationCallOrder[0]);
        expect(replaceManualArtworkRecord.mock.invocationCallOrder[0])
            .toBeLessThan(deleteArtworkObject.mock.invocationCallOrder[0]);
        expect(deleteArtworkObject).toHaveBeenCalledWith(oldKey);
    });

    it("sprzata nowy obiekt gdy zapis DB sie nie powiedzie", async () => {
        replaceManualArtworkRecord.mockRejectedValue(new DatabaseError("unknown", 500, "db"));

        await expect(saveManualArtwork("Test", "poster", Buffer.from("input")))
            .resolves.toEqual({ ok: false, code: "server" });
        expect(deleteArtworkObject).toHaveBeenCalledWith(putArtworkObject.mock.calls[0]?.[0]);
    });

    it("sprzata nowy obiekt dla nieznanej serii", async () => {
        replaceManualArtworkRecord.mockResolvedValue(null);

        await expect(saveManualArtwork("Test", "poster", Buffer.from("input")))
            .resolves.toEqual({ ok: false, code: "not_found" });
        expect(deleteArtworkObject).toHaveBeenCalledOnce();
    });

    it("nie publikuje plakatu o poziomych wymiarach", async () => {
        processArtwork.mockResolvedValue({ ...processedPoster, width: 900, height: 600 });

        await expect(saveManualArtwork("Test", "poster", Buffer.from("input")))
            .resolves.toEqual({ ok: false, code: "invalid_dimensions" });
        expect(putArtworkObject).not.toHaveBeenCalled();
        expect(replaceManualArtworkRecord).not.toHaveBeenCalled();
    });

    it("awaria sprzatania starego obiektu nie cofa poprawnie opublikowanej grafiki", async () => {
        replaceManualArtworkRecord.mockResolvedValue({
            id: 9,
            url: "/api/artwork?id=9",
            replacedStorageKeys: ["artwork/Test/poster/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp"],
        });
        deleteArtworkObject.mockRejectedValueOnce(new Error("B2 delete failed"));

        await expect(saveManualArtwork("Test", "poster", Buffer.from("input")))
            .resolves.toEqual({ ok: true, id: 9, url: "/api/artwork?id=9" });
    });
});

describe("buildArtworkRedirect", () => {
    it("podpisuje tylko storage_key odczytany z bazy", async () => {
        const key = "artwork/Test/poster/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";
        findArtworkStorageKey.mockResolvedValue(key);
        presignArtworkObject.mockResolvedValue("https://b2.example/signed");

        await expect(buildArtworkRedirect(9)).resolves.toEqual({ ok: true, url: "https://b2.example/signed" });
        expect(presignArtworkObject).toHaveBeenCalledWith(key, 21_600);
    });

    it("nie podpisuje starego rekordu bez storage_key", async () => {
        findArtworkStorageKey.mockResolvedValue(null);
        await expect(buildArtworkRedirect(9)).resolves.toEqual({ ok: false, code: "not_found" });
        expect(presignArtworkObject).not.toHaveBeenCalled();
    });
});
