import { describe, expect, it, vi } from "vitest";
import { listAdminLibrary } from "../adminLibraryRepository";

describe("listAdminLibrary", () => {
    it("buduje bibliotekę wyłącznie z gotowych media_assets i sumuje rozmiary HLS", async () => {
        const execute = vi.fn().mockResolvedValue([[
            { series_key: "A", episode_key: "01.mp4", size_bytes: 100, title: "Pierwszy", duration_seconds: 60, visibility: "public" },
            { series_key: "A", episode_key: "02.mp4", size_bytes: 250, title: null, duration_seconds: 70, visibility: "public" },
            { series_key: "B", episode_key: "01.mp4", size_bytes: null, title: null, duration_seconds: null, visibility: null },
        ]]);

        await expect(listAdminLibrary({ execute } as never)).resolves.toEqual({ series: [
            { seriesKey: "A", episodeCount: 2, totalBytes: 350, visibility: "public", episodes: [
                { episodeKey: "01.mp4", sizeBytes: 100, title: "Pierwszy", durationSeconds: 60 },
                { episodeKey: "02.mp4", sizeBytes: 250, title: null, durationSeconds: 70 },
            ] },
            { seriesKey: "B", episodeCount: 1, totalBytes: 0, visibility: "restricted", episodes: [
                { episodeKey: "01.mp4", sizeBytes: 0, title: null, durationSeconds: null },
            ] },
        ] });
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/FROM media_assets[\s\S]*WHERE a\.status = 'ready'/));
    });
});
