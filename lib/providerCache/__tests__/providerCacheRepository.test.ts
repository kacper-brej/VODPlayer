import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { getCachedResponse, upsertCachedResponse } = await import("../providerCacheRepository");

beforeEach(() => execute.mockReset());

describe("getCachedResponse", () => {
    it("brak wiersza -> null", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(getCachedResponse("tmdb", "abc")).resolves.toBeNull();
    });

    it("wiek liczony w SQL przez TIMESTAMPDIFF wzgledem UTC_TIMESTAMP -- tz-bezpieczne, nie UNIX_TIMESTAMP", async () => {
        execute.mockResolvedValueOnce([[{ response_json: "{}", age_seconds: 42 }]]);
        await getCachedResponse("tmdb", "abc");
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/TIMESTAMPDIFF\(SECOND, fetched_at, UTC_TIMESTAMP\(\)\)/),
            ["tmdb", "abc"],
        );
    });

    it("zwraca surowy JSON i wiek w sekundach bez parsowania", async () => {
        execute.mockResolvedValueOnce([[{ response_json: '{"title":"Naruto"}', age_seconds: 10 }]]);
        await expect(getCachedResponse("tmdb", "abc")).resolves.toEqual({
            responseJson: '{"title":"Naruto"}',
            ageSeconds: 10,
        });
    });
});

describe("upsertCachedResponse", () => {
    it("uzywa ON DUPLICATE KEY UPDATE po (provider, cache_key), zapisuje przez UTC_TIMESTAMP", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertCachedResponse("tmdb", "abc", "/tv/1", "{}");
        const [sql] = execute.mock.calls[0] as [string, unknown[]];
        expect(sql).toMatch(/UTC_TIMESTAMP\(\)/);
        expect(sql).toMatch(/ON DUPLICATE KEY UPDATE/);
        expect(execute).toHaveBeenCalledWith(expect.any(String), ["tmdb", "abc", "/tv/1", "{}"]);
    });
});
