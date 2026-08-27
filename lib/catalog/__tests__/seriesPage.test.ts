import { describe, expect, it } from "vitest";
import { getSeasonEpisodeCount, getSeriesSeasons } from "@/lib/catalog/seriesPage";
import { catalogSeriesFixture } from "./catalogSeriesFixture";

describe("sezony strony serialu", () => {
    it("sortuje grupe i zachowuje metadane kazdego sezonu", () => {
        const seasonTwo = catalogSeriesFixture("Reacher S2", {
            id: 1_000_002,
            groupId: 7,
            seasonNumber: 2,
            baseTitle: "Reacher",
            year: 2023,
            sourceRating: "8.0",
        });
        const seasonOne = catalogSeriesFixture("Reacher S1", {
            id: 1_000_001,
            groupId: 7,
            seasonNumber: 1,
            baseTitle: "Reacher",
            year: 2022,
            sourceRating: "8.1",
        });

        const seasons = getSeriesSeasons([seasonTwo, seasonOne], seasonOne);

        expect(seasons.map((season) => season.id)).toEqual(["1", "2"]);
        expect(seasons[0]?.source).toBe(seasonOne);
        expect(seasons[1]?.source).toBe(seasonTwo);
        expect(seasons[1]?.source.year).toBe(2023);
    });

    it("uzywa deklarowanej liczby tylko dopoki odcinki nie zostaly pobrane", () => {
        const series = catalogSeriesFixture("Reacher", { episodes: [] });
        const [season] = getSeriesSeasons([series], series);

        expect(getSeasonEpisodeCount(season)).toBe(0);
        expect(getSeasonEpisodeCount(season && { ...season, declaredEpisodeCount: 8 })).toBe(8);
        expect(getSeasonEpisodeCount(season && {
            ...season,
            declaredEpisodeCount: 8,
            episodes: catalogSeriesFixture("loaded").episodes,
        })).toBe(1);
    });
});
