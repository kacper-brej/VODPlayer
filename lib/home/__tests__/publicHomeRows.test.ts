import { describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import { buildNewestHomeRow, getPublicHomeRows } from "../publicHomeRows";

const tmdbItem = (id: number) => ({
    id,
    name: `TMDB ${id}`,
    popularity: id,
    vote_average: 8,
    vote_count: 100,
    first_air_date: null,
    genre_ids: [],
});

const success = (...ids: number[]) => ({
    kind: "success" as const,
    data: ids.map(tmdbItem),
});

const catalog = Array.from({ length: 25 }, (_, index) =>
    catalogSeriesFixture(`Series ${index + 1}`, {
        id: 1_000_001 + index,
        tmdbExternalId: index + 1,
        episodes: [{
            ...catalogSeriesFixture("episode").episodes[0]!,
            addedAt: index + 1,
        }],
    })
);

const sources = (overrides: Partial<Parameters<typeof getPublicHomeRows>[1]> = {}) => ({
    trendingToday: vi.fn().mockResolvedValue(success(...Array.from({ length: 15 }, (_, index) => index + 1))),
    popularNow: vi.fn().mockResolvedValue(success(4, 3, 2, 1)),
    topRated: vi.fn().mockResolvedValue(success(1, 2, 3, 4)),
    onTheAir: vi.fn().mockResolvedValue(success(2, 3, 4, 5)),
    ...overrides,
});

describe("publiczne sekcje strony glownej", () => {
    it("buduje piec sekcji we wspolnym kontrakcie i zachowuje kolejnosc TMDB", async () => {
        const rows = await getPublicHomeRows(catalog, sources());

        expect(rows).toHaveLength(5);
        expect(rows.every((row) => row.kind === "ready")).toBe(true);
        expect(rows[0]).toMatchObject({
            kind: "ready",
            row: { id: "trending-today", variant: "ranking" },
        });
        expect(rows[0]?.kind === "ready" && rows[0].row.items.slice(0, 2).map((item) => item.key))
            .toEqual(["Series 1", "Series 2"]);
        expect(rows[2]?.kind === "ready" && rows[2].row.items.slice(0, 2).map((item) => item.key))
            .toEqual(["Series 4", "Series 3"]);
    });

    it("ogranicza dzienny trending do Top 10", async () => {
        const rows = await getPublicHomeRows(catalog, sources());
        const trending = rows[0];

        expect(trending.kind).toBe("ready");
        if (trending.kind === "ready") expect(trending.row.items).toHaveLength(10);
    });

    it("pomija sekcje TMDB z mniej niz trzema lokalnymi dopasowaniami", async () => {
        const rows = await getPublicHomeRows(catalog, sources({
            topRated: vi.fn().mockResolvedValue(success(1, 999)),
        }));

        expect(rows[3]).toMatchObject({
            kind: "omitted",
            id: "top-rated",
            reason: "insufficient_matches",
        });
    });

    it("awaria jednej listy nie przerywa pozostalych ani lokalnych nowosci", async () => {
        const rows = await getPublicHomeRows(catalog, sources({
            trendingToday: vi.fn().mockRejectedValue(new Error("provider down")),
        }));

        expect(rows[0]).toEqual({
            kind: "error",
            id: "trending-today",
            source: "tmdb-trending-day",
            reason: "server",
        });
        expect(rows.slice(1).every((row) => row.kind === "ready")).toBe(true);
    });

    it("sortuje lokalne nowosci po dacie dodania odcinka bez TMDB", () => {
        const row = buildNewestHomeRow(catalog.slice(0, 3));

        expect(row).toMatchObject({
            kind: "ready",
            row: {
                source: "local-newest",
                items: [{ key: "Series 3" }, { key: "Series 2" }, { key: "Series 1" }],
            },
        });
    });

    it("uzupelnia rzad tytulem TMDB nieobecnym w katalogu widza", async () => {
        const viewerCatalog = catalog.slice(0, 3);
        const rows = await getPublicHomeRows(viewerCatalog, sources({
            popularNow: vi.fn().mockResolvedValue(success(999, 3, 2, 1)),
        }));
        const popular = rows[2];

        expect(popular.kind).toBe("ready");
        if (popular.kind === "ready") {
            expect(popular.row.items.map((series) => series.key)).toEqual([
                "tmdb:999",
                "Series 3",
                "Series 2",
                "Series 1",
            ]);
        }
    });

    it("tytul wylacznie z TMDB dostaje tryb pokazowy i nie udaje pozycji lokalnej", async () => {
        const viewerCatalog = catalog.slice(0, 3);
        const rows = await getPublicHomeRows(viewerCatalog, sources({
            popularNow: vi.fn().mockResolvedValue(success(999, 3, 2, 1)),
        }));
        const popular = rows[2];

        expect(popular.kind).toBe("ready");
        if (popular.kind === "ready") {
            expect(popular.row.items[0]).toMatchObject({
                key: "tmdb:999",
                access: "demo",
                tmdbExternalId: 999,
                episodes: [],
            });
        }
    });

    it("lokalne dopasowanie ma pierwszenstwo przed wpisem wirtualnym", async () => {
        const rows = await getPublicHomeRows(catalog, sources({
            popularNow: vi.fn().mockResolvedValue(success(3, 2, 1)),
        }));
        const popular = rows[2];

        expect(popular.kind).toBe("ready");
        if (popular.kind === "ready") {
            expect(popular.row.items.every((series) => !series.key.startsWith("tmdb:"))).toBe(true);
        }
    });
});
