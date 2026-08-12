import { describe, expect, it, vi } from "vitest";
import {
    hasReadyMediaAsset,
    listReadyEpisodesForBackfill,
    upsertEpisodeMetadata,
} from "../episodeMetadataRepository";

describe("episodeMetadataRepository", () => {
    it("uznaje za istniejący wyłącznie gotowy asset HLS", async () => {
        const execute = vi.fn().mockResolvedValue([[{ found: 1 }]]);

        await expect(hasReadyMediaAsset("Test", "01.mp4", { execute } as never)).resolves.toBe(true);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/media_assets[\s\S]*status = 'ready'/),
            ["Test", "01.mp4"],
        );
    });

    it("upsert zmienia tylko jawnie przekazane pola", async () => {
        const execute = vi.fn()
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[
                {
                    episode_key: "01.mp4",
                    title: "Nowy tytuł",
                    synopsis: "Stary opis",
                    duration_seconds: 1400,
                    thumbnail_path: null,
                    thumbnail_source: null,
                },
            ]]);

        await expect(upsertEpisodeMetadata({
            seriesKey: "Test",
            episodeKey: "01.mp4",
            title: "Nowy tytuł",
        }, { execute } as never)).resolves.toMatchObject({ title: "Nowy tytuł", synopsis: "Stary opis" });

        expect(execute.mock.calls[0]?.[0]).toEqual(expect.stringMatching(/title = IF\(\?, VALUES\(title\), title\)/));
        expect(execute.mock.calls[0]?.[1]).toEqual([
            "Test", "01.mp4", "Nowy tytuł", null, null, null, null,
            1, 0, 0, 0, 0,
        ]);
    });

    it("widok backfillu bierze wszystkie ready z bazy bez bramki plakatu", async () => {
        const execute = vi.fn().mockResolvedValue([[]]);

        await listReadyEpisodesForBackfill({ execute } as never);

        const sql = String(execute.mock.calls[0]?.[0]);
        expect(sql).toContain("a.status = 'ready'");
        expect(sql).not.toContain("series_artwork");
        expect(sql).not.toContain("is_primary");
    });
});
