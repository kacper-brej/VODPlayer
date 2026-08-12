import { describe, expect, it, vi } from "vitest";
import { findGrantedPreviewAsset, findPreviewSessionAsset } from "../previewRepository";

const rows = [{
    asset_id: 42,
    asset_version: 7,
    series_key: "Test",
    episode_key: "01.mp4",
    duration_seconds: 1200,
    preview_start_seconds: 30,
    preview_clip_key: "media/Test/01.mp4/preview.mp4",
    height: 480,
    playlist_key: "media/Test/01.mp4/480/index.m3u8",
    progress_asset_version: 7,
    position_seconds: 100,
    progress_duration_seconds: 1200,
    completed: 0,
}];

describe("preview read model", () => {
    it("pobiera asset, renditiony i progress jednego profilu jednym zapytaniem", async () => {
        const execute = vi.fn().mockResolvedValue([rows]);
        const result = await findPreviewSessionAsset(11, "Test", "01.mp4", undefined, { execute } as never);
        expect(result).toMatchObject({
            id: 42,
            version: 7,
            progress: { assetVersion: 7, positionSeconds: 100, completed: false },
            renditions: [{ height: 480 }],
        });
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/LEFT JOIN watch_progress wp\s+ON wp\.profile_id = \?/),
            [11, "Test", "01.mp4", "Test", "01.mp4"],
        );
    });

    it("grant wymaga aktualnej wersji gotowego assetu", async () => {
        const execute = vi.fn().mockResolvedValue([rows]);
        await findGrantedPreviewAsset(42, 7, "Test", "01.mp4", { execute } as never);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/a\.id = \? AND a\.asset_version = \?[\s\S]+a\.status = 'ready'/),
            [42, 7, "Test", "01.mp4"],
        );
    });

    it("zwraca null dla brakujacego assetu", async () => {
        const execute = vi.fn().mockResolvedValue([[]]);
        await expect(findPreviewSessionAsset(11, "X", "01.mp4", undefined, { execute } as never)).resolves.toBeNull();
    });

    it("postęp jest czytany po kluczach tytułu, także gdy asset pochodzi z innego materiału", async () => {
        const execute = vi.fn().mockResolvedValue([rows]);
        await findPreviewSessionAsset(
            11,
            "_demo",
            "demo.mp4",
            { seriesKey: "Tokyo Ghoul", episodeKey: "01.mp4" },
            { execute } as never,
        );
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/wp\.series_key = \? AND wp\.episode_key = \?/),
            [11, "Tokyo Ghoul", "01.mp4", "_demo", "demo.mp4"],
        );
    });
});
