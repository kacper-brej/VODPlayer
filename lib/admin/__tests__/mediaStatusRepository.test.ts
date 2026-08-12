import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { listMediaAssetsWithRenditions, getLastVerificationRun } = await import("../mediaStatusRepository");

beforeEach(() => execute.mockReset());

describe("listMediaAssetsWithRenditions", () => {
    it("laczy renditiony do wlasciwego assetu po asset_id, formatuje updated_at jako string bez konwersji przez sterownik", async () => {
        execute.mockResolvedValueOnce([[
            { id: 1, series_key: "Naruto", episode_key: "01.mp4", status: "ready", duration_seconds: 1200, total_size_bytes: 500, preview_clip_key: null, error_message: null, updated_at: "2026-08-07 12:00:00" },
        ]]);
        execute.mockResolvedValueOnce([[
            { asset_id: 1, height: 1080, width: 1920, bitrate_kbps: 5000, playlist_key: "media/naruto/01/1080.m3u8", segment_count: 100, size_bytes: 300 },
            { asset_id: 1, height: 720, width: 1280, bitrate_kbps: 2500, playlist_key: "media/naruto/01/720.m3u8", segment_count: 100, size_bytes: 200 },
        ]]);

        const result = await listMediaAssetsWithRenditions();

        expect(result).toEqual([{
            seriesKey: "Naruto",
            episodeKey: "01.mp4",
            status: "ready",
            durationSeconds: 1200,
            totalSizeBytes: 500,
            previewClipKey: null,
            errorMessage: null,
            updatedAt: "2026-08-07 12:00:00",
            renditions: [
                { height: 1080, width: 1920, bitrateKbps: 5000, playlistKey: "media/naruto/01/1080.m3u8", segmentCount: 100, sizeBytes: 300 },
                { height: 720, width: 1280, bitrateKbps: 2500, playlistKey: "media/naruto/01/720.m3u8", segmentCount: 100, sizeBytes: 200 },
            ],
        }]);
    });

    it("asset bez renditionow dostaje pusta tablice, nie undefined", async () => {
        execute.mockResolvedValueOnce([[
            { id: 2, series_key: "Bleach", episode_key: "01.mp4", status: "processing", duration_seconds: null, total_size_bytes: null, preview_clip_key: null, error_message: null, updated_at: "2026-08-07 12:00:00" },
        ]]);
        execute.mockResolvedValueOnce([[]]);

        const result = await listMediaAssetsWithRenditions();
        expect(result[0]?.renditions).toEqual([]);
    });
});

describe("getLastVerificationRun", () => {
    it("brak wpisow -> null", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(getLastVerificationRun()).resolves.toBeNull();
    });

    it("sortuje po ran_at malejaco, bierze najnowszy", async () => {
        execute.mockResolvedValueOnce([[{ ran_at: "2026-08-07 03:00:00", checked_count: 50, failed_count: 2 }]]);
        await expect(getLastVerificationRun()).resolves.toEqual({ ranAt: "2026-08-07 03:00:00", checkedCount: 50, failedCount: 2 });
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY ran_at DESC/));
    });
});
