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
    it("uses a parameterized UTC fetch timestamp for the cache upsert", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertCachedResponse("tmdb", "abc", "/tv/1", "{}");
        const [sql] = execute.mock.calls[0] as [string, unknown[]];
        expect(sql).toMatch(/VALUES \(\?, \?, \?, \?, \?\)/);
        expect(sql).toMatch(/ON DUPLICATE KEY UPDATE/);
        expect(execute).toHaveBeenCalledWith(expect.any(String), ["tmdb", "abc", "/tv/1", "{}", expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)]);
    });

    it("preserves the fixed fetch timestamp across response and database pool delays", async () => {
        const fetchedAt = Date.parse("2026-09-15T17:00:00.987Z");
        const clock = vi.spyOn(Date, "now").mockReturnValue(fetchedAt + 120_000);
        let releaseConnection!: () => void;
        const connection = new Promise<void>((resolve) => { releaseConnection = resolve; });
        let storedTimestamp: unknown;
        execute.mockImplementationOnce(async (_sql: string, values: unknown[]) => {
            await connection;
            storedTimestamp = values[4];
            return [{}];
        });
        try {
            const write = upsertCachedResponse("tmdb", "abc", "/tv/1", "{}", fetchedAt);
            expect(storedTimestamp).toBeUndefined();
            clock.mockReturnValue(fetchedAt + 300_000);
            releaseConnection();
            await write;
            expect(storedTimestamp).toBe("2026-09-15 17:00:00");
            expect(execute).toHaveBeenCalledWith(expect.any(String), ["tmdb", "abc", "/tv/1", "{}", "2026-09-15 17:00:00"]);
        } finally {
            clock.mockRestore();
        }
    });

    it("retains the stored payload for older writes and timestamps tied at database precision", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertCachedResponse("tmdb", "abc", "/tv/1", "{}");
        const [sql] = execute.mock.calls[0] as [string, unknown[]];
        expect(sql).toMatch(/request_path = IF\(VALUES\(fetched_at\) > fetched_at, VALUES\(request_path\), request_path\)/);
        expect(sql).toMatch(/response_json = IF\(VALUES\(fetched_at\) > fetched_at, VALUES\(response_json\), response_json\)/);
        expect(sql).toMatch(/fetched_at = GREATEST\(fetched_at, VALUES\(fetched_at\)\)/);
    });
});
