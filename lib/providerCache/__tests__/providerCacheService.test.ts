import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { DatabaseError } from "@/lib/db/errors";

const repo = {
    getCachedResponse: vi.fn(),
    upsertCachedResponse: vi.fn(),
};
vi.mock("@/lib/providerCache/providerCacheRepository", () => repo);

const { getCachedResponse, setCachedResponse } = await import("../providerCacheService");

const hashOf = (path: string) => createHash("sha256").update(path).digest("hex");

beforeEach(() => vi.clearAllMocks());

describe("getCachedResponse — walidacja i klucz cache", () => {
    it("pusty provider -> null, brak zapytania do bazy", async () => {
        await expect(getCachedResponse("", "/tv/1")).resolves.toBeNull();
        expect(repo.getCachedResponse).not.toHaveBeenCalled();
    });

    it("provider dluzszy niz 16 znakow -> null", async () => {
        await expect(getCachedResponse("x".repeat(17), "/tv/1")).resolves.toBeNull();
    });

    it("pusty path -> null", async () => {
        await expect(getCachedResponse("tmdb", "")).resolves.toBeNull();
    });

    it("hashuje path przez SHA-256, identycznie jak PHP hash('sha256', $path)", async () => {
        repo.getCachedResponse.mockResolvedValue(null);
        await getCachedResponse("tmdb", "/tv/1399");
        expect(repo.getCachedResponse).toHaveBeenCalledWith("tmdb", hashOf("/tv/1399"));
    });
});

describe("getCachedResponse — brak wpisu i uszkodzony payload", () => {
    it("brak wpisu -> null", async () => {
        repo.getCachedResponse.mockResolvedValue(null);
        await expect(getCachedResponse("tmdb", "/tv/1")).resolves.toBeNull();
    });

    it("uszkodzony JSON w bazie -> traktowane jak brak wpisu (null), nie rzuca", async () => {
        repo.getCachedResponse.mockResolvedValue({ responseJson: "{not valid json", ageSeconds: 5 });
        await expect(getCachedResponse("tmdb", "/tv/1")).resolves.toBeNull();
    });

    it("blad bazy -> null (fail-open na odczycie), nie wywraca calego zapytania providera", async () => {
        repo.getCachedResponse.mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));
        await expect(getCachedResponse("tmdb", "/tv/1")).resolves.toBeNull();
    });
});

describe("getCachedResponse — trafienie", () => {
    it("zwraca dane sparsowane z JSON i fetchedAtMs wyliczone z wieku w sekundach", async () => {
        const now = Date.now();
        vi.spyOn(Date, "now").mockReturnValue(now);
        repo.getCachedResponse.mockResolvedValue({ responseJson: '{"title":"Naruto"}', ageSeconds: 30 });

        await expect(getCachedResponse("tmdb", "/tv/1")).resolves.toEqual({
            data: { title: "Naruto" },
            fetchedAtMs: now - 30_000,
        });

        vi.restoreAllMocks();
    });
});

describe("setCachedResponse — walidacja i brak zapisu uszkodzonych odpowiedzi", () => {
    it("pusty provider/path -> invalid, brak zapisu", async () => {
        await expect(setCachedResponse("", "/tv/1", {})).resolves.toEqual({ ok: false, code: "invalid" });
        await expect(setCachedResponse("tmdb", "", {})).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.upsertCachedResponse).not.toHaveBeenCalled();
    });

    it("dane niemozliwe do zserializowania (referencja cykliczna) -> invalid, brak zapisu -- nie zatruwa cache", async () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        await expect(setCachedResponse("tmdb", "/tv/1", circular)).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.upsertCachedResponse).not.toHaveBeenCalled();
    });

    it("sukces -- zapisuje zserializowany JSON pod zahashowanym kluczem", async () => {
        repo.upsertCachedResponse.mockResolvedValue(undefined);
        await expect(setCachedResponse("tmdb", "/tv/1", { title: "Naruto" })).resolves.toEqual({ ok: true });
        expect(repo.upsertCachedResponse).toHaveBeenCalledWith("tmdb", hashOf("/tv/1"), "/tv/1", '{"title":"Naruto"}');
    });

    it("blad bazy przy zapisie -> server", async () => {
        repo.upsertCachedResponse.mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));
        await expect(setCachedResponse("tmdb", "/tv/1", {})).resolves.toEqual({ ok: false, code: "server" });
    });
});
