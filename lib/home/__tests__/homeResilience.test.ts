import { describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import { dataFailure, dataSuccess, type DataErrorReason } from "@/lib/core/dataResult";
import { planHomeSections, readyHomeRows } from "../homeLayout";
import { getPublicHomeRows } from "../publicHomeRows";

const catalog = Array.from({ length: 12 }, (_, index) =>
    catalogSeriesFixture(`S${index + 1}`, {
        id: 1_000_001 + index,
        tmdbExternalId: index + 1,
        episodes: [{
            ...catalogSeriesFixture("episode").episodes[0]!,
            addedAt: index + 1,
        }],
    })
);

const tmdbItem = (id: number) => ({
    id,
    name: `TMDB ${id}`,
    popularity: id,
    vote_average: 8,
    vote_count: 100,
    first_air_date: null,
    genre_ids: [],
});

const allFailing = (reason: DataErrorReason, status?: number) => {
    const loader = vi.fn().mockResolvedValue(dataFailure(reason, status));

    return {
        trendingToday: loader,
        popularNow: loader,
        topRated: loader,
        onTheAir: loader,
    };
};

const sectionIds = async (sources: Parameters<typeof getPublicHomeRows>[1]) => {
    const rows = await getPublicHomeRows(catalog, sources);

    return planHomeSections(readyHomeRows(rows)).map((section) => section.id);
};

describe("odpornosc sekcji TMDB na stronie glownej", () => {
    it.each([
        ["brak tokenu", "not_configured" as const, undefined],
        ["limit zapytan", "server" as const, 429],
        ["timeout sieci", "network" as const, undefined],
        ["nieprawidlowy JSON", "invalid_response" as const, undefined],
    ])("%s ukrywa tylko rzedy TMDB i zostawia lokalne nowosci", async (_label, reason, status) => {
        expect(await sectionIds(allFailing(reason, status))).toEqual(["newest-local"]);
    });

    it("awaria jednej listy nie zabiera pozostalych rzedow", async () => {
        const ok = vi.fn().mockResolvedValue(dataSuccess(catalog.map((_, index) => tmdbItem(index + 1))));

        expect(await sectionIds({
            trendingToday: vi.fn().mockResolvedValue(dataFailure("network")),
            popularNow: ok,
            topRated: ok,
            onTheAir: ok,
        })).toEqual(["newest-local", "popular-now", "top-rated", "on-the-air"]);
    });

    it("rzut providera nie przerywa budowania strony", async () => {
        const boom = vi.fn().mockRejectedValue(new Error("provider down"));

        expect(await sectionIds({
            trendingToday: boom,
            popularNow: boom,
            topRated: boom,
            onTheAir: boom,
        })).toEqual(["newest-local"]);
    });

    it("pusta odpowiedz providera nie tworzy pustego naglowka", async () => {
        const empty = vi.fn().mockResolvedValue(dataSuccess([]));

        expect(await sectionIds({
            trendingToday: empty,
            popularNow: empty,
            topRated: empty,
            onTheAir: empty,
        })).toEqual(["newest-local"]);
    });
});
