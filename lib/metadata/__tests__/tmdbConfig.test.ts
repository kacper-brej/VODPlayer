import { afterEach, describe, expect, it, vi } from "vitest";

const originalToken = process.env.TMDB_READ_TOKEN;

afterEach(() => {
    if (originalToken === undefined) {
        delete process.env.TMDB_READ_TOKEN;
    } else {
        process.env.TMDB_READ_TOKEN = originalToken;
    }
    vi.restoreAllMocks();
});

describe("konfiguracja TMDB", () => {
    it("rozroznia brak tokenu od bledu providera", async () => {
        delete process.env.TMDB_READ_TOKEN;
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const { fetchTmdbResult } = await import("../tmdbConfig");

        await expect(fetchTmdbResult("/tv/popular", () => true)).resolves.toEqual({
            kind: "error",
            reason: "not_configured",
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
