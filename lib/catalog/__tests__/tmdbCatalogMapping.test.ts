import { describe, expect, it } from "vitest";
import { catalogSeriesFixture } from "./catalogSeriesFixture";
import { mapTmdbListToCatalog } from "../tmdbCatalogMapping";

const tmdbItems = (...ids: number[]) => ids.map((id) => ({ id }));

describe("mapowanie listy TMDB do katalogu", () => {
    it("zachowuje kolejnosc TMDB i odrzuca brakujace tytuly", () => {
        const catalog = [
            catalogSeriesFixture("A", { tmdbExternalId: 1 }),
            catalogSeriesFixture("B", { tmdbExternalId: 2 }),
        ];

        const result = mapTmdbListToCatalog(tmdbItems(2, 99, 1), catalog, 20);

        expect(result.series.map((series) => series.key)).toEqual(["B", "A"]);
        expect(result.stats).toEqual({
            inputCount: 3,
            matchedCount: 2,
            rejectedCount: 1,
            duplicateCount: 0,
        });
    });

    it("nie dopasowuje serialu bez TMDB ID ani po zgodnej nazwie", () => {
        const catalog = [catalogSeriesFixture("Ten sam tytul")];

        const result = mapTmdbListToCatalog(tmdbItems(10), catalog, 20);

        expect(result.series).toEqual([]);
        expect(result.stats.rejectedCount).toBe(1);
    });

    it("usuwa zduplikowane TMDB ID", () => {
        const catalog = [catalogSeriesFixture("A", { tmdbExternalId: 1 })];

        const result = mapTmdbListToCatalog(tmdbItems(1, 1), catalog, 20);

        expect(result.series).toHaveLength(1);
        expect(result.stats.duplicateCount).toBe(1);
    });

    it("wybiera najnizszy sezon grupy niezaleznie od kolejnosci katalogu", () => {
        const catalog = [
            catalogSeriesFixture("Show_S2", {
                groupId: 7,
                seasonNumber: 2,
                tmdbExternalId: 50,
            }),
            catalogSeriesFixture("Show_S1", {
                groupId: 7,
                seasonNumber: 1,
                tmdbExternalId: 50,
            }),
        ];

        const result = mapTmdbListToCatalog(tmdbItems(50), catalog, 20);

        expect(result.series.map((series) => series.key)).toEqual(["Show_S1"]);
    });

    it("usuwa duplikat grupy nawet przy roznych TMDB ID", () => {
        const catalog = [
            catalogSeriesFixture("Show_S1", {
                groupId: 7,
                seasonNumber: 1,
                tmdbExternalId: 50,
            }),
            catalogSeriesFixture("Show_S2", {
                groupId: 7,
                seasonNumber: 2,
                tmdbExternalId: 51,
            }),
        ];

        const result = mapTmdbListToCatalog(tmdbItems(51, 50), catalog, 20);

        expect(result.series.map((series) => series.key)).toEqual(["Show_S1"]);
        expect(result.stats.duplicateCount).toBe(1);
    });

    it("stosuje limit bez mutowania wejsc", () => {
        const catalog = [
            catalogSeriesFixture("A", { tmdbExternalId: 1 }),
            catalogSeriesFixture("B", { tmdbExternalId: 2 }),
        ];
        const items = tmdbItems(2, 1);
        const catalogSnapshot = [...catalog];
        const itemsSnapshot = items.map((item) => ({ ...item }));

        const result = mapTmdbListToCatalog(items, catalog, 1);

        expect(result.series.map((series) => series.key)).toEqual(["B"]);
        expect(result.stats.rejectedCount).toBe(1);
        expect(catalog).toEqual(catalogSnapshot);
        expect(items).toEqual(itemsSnapshot);
    });

    it("nie moze zwrocic tytulu nieobecnego w katalogu aktualnego widza", () => {
        const viewerCatalog = [catalogSeriesFixture("Dostepny", { tmdbExternalId: 1 })];

        const result = mapTmdbListToCatalog(tmdbItems(2, 1), viewerCatalog, 20);

        expect(result.series.map((series) => series.key)).toEqual(["Dostepny"]);
    });
});
