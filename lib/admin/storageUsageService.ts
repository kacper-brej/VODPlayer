import "server-only";
import type { StorageUsageResponse } from "@/lib/core/contracts";
import * as repo from "@/lib/admin/storageUsageRepository";

export const getStorageUsage = async (): Promise<StorageUsageResponse> => {
    const currentTotalBytes = await repo.sumReadyMediaAssetBytes();
    const today = await repo.getCurrentDate();
    const history = await repo.listSnapshotsSince90Days(today);

    const currentMonthPrefix = today.slice(0, 7);
    const currentMonthRows = history.filter((row) => row.date.startsWith(currentMonthPrefix));
    const currentMonthAverageBytes = currentMonthRows.length > 0
        ? Math.round(currentMonthRows.reduce((sum, row) => sum + row.totalBytes, 0) / currentMonthRows.length)
        : currentTotalBytes;

    return { currentTotalBytes, currentMonthAverageBytes, history };
};

export const captureStorageUsageSnapshot = async (): Promise<void> => {
    const totalBytes = await repo.sumReadyMediaAssetBytes();
    const today = await repo.getCurrentDate();
    await repo.upsertSnapshot(today, totalBytes);
};
