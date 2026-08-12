import { describe, expect, it, vi, beforeEach } from "vitest";

const repo = {
    sumReadyMediaAssetBytes: vi.fn(),
    getCurrentDate: vi.fn(),
    upsertSnapshot: vi.fn(),
    listSnapshotsSince90Days: vi.fn(),
};
vi.mock("@/lib/admin/storageUsageRepository", () => repo);

const { captureStorageUsageSnapshot, getStorageUsage } = await import("../storageUsageService");

beforeEach(() => {
    vi.clearAllMocks();
    repo.getCurrentDate.mockResolvedValue("2026-08-07");
    repo.upsertSnapshot.mockResolvedValue(undefined);
});

describe("storage usage — rozdzielony odczyt i zapis", () => {
    it("odczyt nie zapisuje snapshotu", async () => {
        repo.sumReadyMediaAssetBytes.mockResolvedValue(1000);
        repo.listSnapshotsSince90Days.mockResolvedValue([]);
        await getStorageUsage();
        expect(repo.upsertSnapshot).not.toHaveBeenCalled();
    });

    it("jawna operacja zapisuje snapshot bieżącego dnia", async () => {
        repo.sumReadyMediaAssetBytes.mockResolvedValue(1000);
        await captureStorageUsageSnapshot();
        expect(repo.upsertSnapshot).toHaveBeenCalledWith("2026-08-07", 1000);
    });
});

describe("getStorageUsage — średnia bieżącego miesiąca", () => {
    it("bez historii używa currentTotalBytes", async () => {
        repo.sumReadyMediaAssetBytes.mockResolvedValue(1000);
        repo.listSnapshotsSince90Days.mockResolvedValue([]);
        await expect(getStorageUsage()).resolves.toMatchObject({ currentTotalBytes: 1000, currentMonthAverageBytes: 1000 });
    });

    it("liczy średnią tylko z bieżącego miesiąca", async () => {
        repo.sumReadyMediaAssetBytes.mockResolvedValue(1000);
        repo.listSnapshotsSince90Days.mockResolvedValue([
            { date: "2026-07-15", totalBytes: 500 },
            { date: "2026-08-01", totalBytes: 800 },
            { date: "2026-08-07", totalBytes: 1000 },
        ]);
        await expect(getStorageUsage()).resolves.toMatchObject({ currentMonthAverageBytes: 900 });
    });

    it("zwraca pełną historię", async () => {
        repo.sumReadyMediaAssetBytes.mockResolvedValue(1000);
        const history = [{ date: "2026-06-01", totalBytes: 200 }, { date: "2026-08-07", totalBytes: 1000 }];
        repo.listSnapshotsSince90Days.mockResolvedValue(history);
        await expect(getStorageUsage()).resolves.toMatchObject({ history });
    });
});
