import { describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import { dataSuccess } from "@/lib/core/dataResult";
import type { ResumePoint } from "@/lib/core/contracts";
import { resolveResumeCatalogSeries } from "../resumeCatalogSeries";

const resume = (seriesKey: string, episodeKey: string): ResumePoint => ({
    seriesKey,
    episodeKey,
    positionSeconds: 120,
    durationSeconds: 600,
    updatedAt: 10,
});

describe("rozwiązywanie tytułu dla kontynuacji", () => {
    it("zwraca lokalny tytuł bez odpytywania zewnętrznego katalogu", async () => {
        const local = catalogSeriesFixture("Naruto");
        const resolveSeries = vi.fn();
        const loadEpisodes = vi.fn();

        await expect(resolveResumeCatalogSeries(
            [local],
            resume("Naruto", "01.mp4"),
            { resolveSeries, loadEpisodes },
        )).resolves.toBe(local);
        expect(resolveSeries).not.toHaveBeenCalled();
        expect(loadEpisodes).not.toHaveBeenCalled();
    });

    it("odtwarza wirtualny film TMDB, którego nie ma w lokalnym katalogu", async () => {
        const movie = catalogSeriesFixture("tmdb:movie:603", {
            id: 3_000_603,
            episodes: [{
                ...catalogSeriesFixture("episode").episodes[0]!,
                key: "1x01",
            }],
        });
        const resolveSeries = vi.fn().mockResolvedValue(dataSuccess(movie));
        const loadEpisodes = vi.fn();

        await expect(resolveResumeCatalogSeries(
            [],
            resume("tmdb:movie:603", "1x01"),
            { resolveSeries, loadEpisodes },
        )).resolves.toBe(movie);
        expect(resolveSeries).toHaveBeenCalledWith("tmdb:movie:603");
        expect(loadEpisodes).not.toHaveBeenCalled();
    });

    it("dociąga właściwy sezon wirtualnego serialu TMDB", async () => {
        const firstSeason = catalogSeriesFixture("tmdb:1399", {
            id: 2_001_399,
            seasonNumber: 1,
            episodes: [{
                ...catalogSeriesFixture("episode").episodes[0]!,
                key: "1x01",
            }],
        });
        const seasonTwoEpisode = {
            ...catalogSeriesFixture("episode").episodes[0]!,
            key: "2x03",
            number: 3,
        };
        const resolveSeries = vi.fn().mockResolvedValue(dataSuccess(firstSeason));
        const loadEpisodes = vi.fn().mockResolvedValue([seasonTwoEpisode]);

        const result = await resolveResumeCatalogSeries(
            [],
            resume("tmdb:1399", "2x03"),
            { resolveSeries, loadEpisodes },
        );

        expect(loadEpisodes).toHaveBeenCalledWith(1399, 2);
        expect(result).toMatchObject({
            key: "tmdb:1399",
            seasonNumber: 2,
            episodeCount: 1,
            episodes: [seasonTwoEpisode],
        });
    });
});
