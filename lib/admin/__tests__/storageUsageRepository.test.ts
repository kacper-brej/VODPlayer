import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { sumReadyMediaAssetBytes, getCurrentDate, upsertSnapshot, listSnapshotsSince90Days } = await import("../storageUsageRepository");

beforeEach(() => execute.mockReset());

describe("sumReadyMediaAssetBytes", () => {
    it("liczy wylacznie assety w statusie ready", async () => {
        execute.mockResolvedValueOnce([[{ total_bytes: 12345 }]]);
        await expect(sumReadyMediaAssetBytes()).resolves.toBe(12345);
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/WHERE status = 'ready'/));
    });

    it("brak assetow -> 0 (COALESCE), nie null", async () => {
        execute.mockResolvedValueOnce([[{ total_bytes: 0 }]]);
        await expect(sumReadyMediaAssetBytes()).resolves.toBe(0);
    });
});

describe("getCurrentDate", () => {
    it("data liczona przez CURDATE() w MySQL, nie zegar procesu Node", async () => {
        execute.mockResolvedValueOnce([[{ today: "2026-08-07" }]]);
        await expect(getCurrentDate()).resolves.toBe("2026-08-07");
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/CURDATE\(\)/));
    });
});

describe("upsertSnapshot", () => {
    it("ON DUPLICATE KEY UPDATE po unikalnej dacie", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertSnapshot("2026-08-07", 500);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/ON DUPLICATE KEY UPDATE total_bytes = VALUES\(total_bytes\)/),
            ["2026-08-07", 500],
        );
    });
});

describe("listSnapshotsSince90Days", () => {
    it("filtruje wzgledem przekazanej daty referencyjnej, nie wlasnego zegara", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listSnapshotsSince90Days("2026-08-07");
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/DATE_SUB\(\?, INTERVAL 90 DAY\)/),
            ["2026-08-07"],
        );
    });

    it("mapuje wiersze na StorageUsageSnapshot", async () => {
        execute.mockResolvedValueOnce([[{ date: "2026-08-01", total_bytes: 100 }]]);
        await expect(listSnapshotsSince90Days("2026-08-07")).resolves.toEqual([{ date: "2026-08-01", totalBytes: 100 }]);
    });
});
