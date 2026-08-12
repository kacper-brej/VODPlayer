import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { consumeWriteRateLimit, deleteStaleWriteRateLimits } = await import("../writeRateLimit");

describe("consumeWriteRateLimit", () => {
    beforeEach(() => execute.mockReset());

    it("zwraca false, gdy licznik mieści się w limicie", async () => {
        execute.mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ request_count: 5 }]]);
        await expect(consumeWriteRateLimit(7, "progress", 10, 900)).resolves.toBe(false);
        expect(execute.mock.calls[0]![1]).toEqual(["user:7:progress"]);
    });

    it("zwraca true po przekroczeniu limitu", async () => {
        execute.mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ request_count: 11 }]]);
        await expect(consumeWriteRateLimit(7, "progress", 10, 900)).resolves.toBe(true);
    });

    it("brak wiersza licznika traktuje jak przekroczenie limitu", async () => {
        execute.mockResolvedValueOnce([{}]).mockResolvedValueOnce([[]]);
        await expect(consumeWriteRateLimit(7, "progress", 10, 900)).resolves.toBe(true);
    });
});

describe("deleteStaleWriteRateLimits", () => {
    beforeEach(() => execute.mockReset());

    it("usuwa okna starsze niż doba, z ograniczeniem liczby wierszy", async () => {
        execute.mockResolvedValueOnce([{}]);
        await deleteStaleWriteRateLimits(250);
        expect(execute).toHaveBeenCalledWith(
            expect.stringContaining("DELETE FROM request_rate_limits"),
            [250],
        );
        expect(execute.mock.calls[0]![0]).toContain("INTERVAL 86400 SECOND");
    });

    it("odrzuca limit poza zakresem, zanim dotknie bazy", async () => {
        await expect(deleteStaleWriteRateLimits(0)).rejects.toThrow("1-10000");
        expect(execute).not.toHaveBeenCalled();
    });
});
