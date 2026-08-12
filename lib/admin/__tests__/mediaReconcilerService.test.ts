import { beforeEach, describe, expect, it, vi } from "vitest";

const listB2MediaObjectKeys = vi.fn();
vi.mock("@/lib/admin/b2AdminStorage", () => ({ listB2MediaObjectKeys }));

const listAssetsForReconciliation = vi.fn();
vi.mock("@/lib/admin/mediaReconcilerRepository", () => ({ listAssetsForReconciliation }));

const { reconcileMediaDryRun } = await import("../mediaReconcilerService");

beforeEach(() => vi.clearAllMocks());

describe("reconcileMediaDryRun", () => {
    it("wyłącznie raportuje deleting, brakujące playlisty i orphan prefixy", async () => {
        listAssetsForReconciliation.mockResolvedValue([
            { id: 1, seriesKey: "Ready", episodeKey: "01.mp4", status: "ready",
                storagePrefix: "media/Ready/01.mp4",
                playlistKeys: ["media/Ready/01.mp4/480p/index.m3u8", "media/Ready/01.mp4/720p/index.m3u8"] },
            { id: 2, seriesKey: "Delete", episodeKey: "02.mp4", status: "delete_failed",
                storagePrefix: "media/Delete/02.mp4", playlistKeys: [] },
        ]);
        listB2MediaObjectKeys.mockResolvedValue({
            keys: [
                "media/Ready/01.mp4/480p/index.m3u8",
                "media/Orphan/09.mp4/480p/index.m3u8",
            ],
            truncated: false,
        });

        const report = await reconcileMediaDryRun();
        expect(report.mode).toBe("dry-run");
        expect(report.retryableDeletes).toEqual([expect.objectContaining({ assetId: 2 })]);
        expect(report.missingPlaylists).toEqual([{ assetId: 1, playlistKey: "media/Ready/01.mp4/720p/index.m3u8" }]);
        expect(report.orphanPrefixes).toEqual(["media/Orphan/09.mp4"]);
    });
});
