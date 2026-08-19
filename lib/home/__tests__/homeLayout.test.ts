import { describe, expect, it } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import { selectFallbackHero, selectResumeHero } from "../homeHero";
import {
    HOME_SECTION_ORDER,
    HOME_SECTION_PRESENTATION,
    applyCrossSectionDedup,
    planHomeSections,
    readyHomeRows,
    type HomeSectionId,
    type HomeSectionRow,
} from "../homeLayout";
import type { HomeRowResult } from "../homeRowTypes";

const library = (size: number): CatalogSeries[] =>
    Array.from({ length: size }, (_, index) =>
        catalogSeriesFixture(`S${index + 1}`, {
            id: 1_000_001 + index,
            tmdbExternalId: index + 1,
            episodes: [{
                ...catalogSeriesFixture("episode").episodes[0]!,
                addedAt: index + 1,
            }],
        })
    );

const row = (
    id: HomeSectionId,
    items: CatalogSeries[],
): HomeSectionRow => ({
    id,
    ...HOME_SECTION_PRESENTATION[id],
    items,
});

const keys = (section: HomeSectionRow | undefined) =>
    section?.items.map((series) => series.key) ?? [];

describe("sklad strony glownej", () => {
    it("uklada sekcje w docelowej kolejnosci niezaleznie od kolejnosci zrodel", () => {
        const catalog = library(30);
        const plan = planHomeSections([
            row("library", catalog),
            row("top-rated", catalog.slice(0, 6)),
            row("continue", catalog.slice(0, 2)),
            row("trending-today", catalog.slice(0, 10)),
        ]);

        expect(plan.map((section) => section.id)).toEqual([
            "continue",
            "trending-today",
            "top-rated",
            "library",
        ]);
    });

    it("kolejnosc referencyjna pokrywa wszystkie sekcje skladu", () => {
        expect([...HOME_SECTION_ORDER].sort()).toEqual(
            Object.keys(HOME_SECTION_PRESENTATION).sort(),
        );
    });

    it("pomija sekcje bez pozycji, wiec numeracja nie ma dziur", () => {
        const catalog = library(30);
        const plan = planHomeSections([
            row("continue", []),
            row("trending-today", catalog.slice(0, 10)),
            row("watchlist", []),
            row("library", catalog),
        ]);

        expect(plan.map((section) => section.id)).toEqual(["trending-today", "library"]);
        expect(plan.every((section) => section.items.length > 0)).toBe(true);
    });

    it("pomija sekcje zakonczone bledem lub pominieciem", () => {
        const catalog = library(30);
        const results: HomeRowResult[] = [
            {
                kind: "ready",
                row: {
                    id: "trending-today",
                    title: "Top 10 trendów dzisiaj",
                    kicker: "TMDB / DZIŚ",
                    source: "tmdb-trending-day",
                    variant: "ranking",
                    items: catalog.slice(0, 10),
                },
            },
            { kind: "omitted", id: "top-rated", source: "tmdb-top-rated", reason: "insufficient_matches" },
            { kind: "error", id: "popular-now", source: "tmdb-popular", reason: "network" },
        ];

        expect(readyHomeRows(results).map((entry) => entry.id)).toEqual(["trending-today"]);
    });

    it("duza biblioteka: sekcje TMDB nie powtarzaja wczesniejszych tytulow", () => {
        const catalog = library(30);
        const plan = applyCrossSectionDedup([
            row("trending-today", catalog.slice(0, 10)),
            row("newest-local", catalog.slice(10, 20)),
            row("popular-now", catalog.slice(5, 25)),
            row("top-rated", catalog.slice(20, 30)),
        ]);
        const byId = new Map(plan.map((section) => [section.id, section]));

        expect(keys(byId.get("trending-today"))).toHaveLength(10);
        expect(keys(byId.get("newest-local"))).toHaveLength(10);
        expect(keys(byId.get("popular-now"))).toEqual(["S21", "S22", "S23", "S24", "S25"]);
        expect(keys(byId.get("top-rated"))).toEqual(["S26", "S27", "S28", "S29", "S30"]);
    });

    it("kontynuacja i moja lista moga powtarzac tytuly, biblioteka pokazuje wszystko", () => {
        const catalog = library(30);
        const plan = applyCrossSectionDedup([
            row("continue", catalog.slice(0, 3)),
            row("trending-today", catalog.slice(0, 10)),
            row("watchlist", catalog.slice(0, 4)),
            row("library", catalog),
        ]);
        const byId = new Map(plan.map((section) => [section.id, section]));

        expect(keys(byId.get("continue"))).toEqual(["S1", "S2", "S3"]);
        expect(keys(byId.get("watchlist"))).toEqual(["S1", "S2", "S3", "S4"]);
        expect(keys(byId.get("library"))).toHaveLength(30);
    });

    it("mala biblioteka: dopuszcza powtorzenia zamiast ukrywac wiekszosc tytulow", () => {
        const catalog = library(5);
        const plan = applyCrossSectionDedup([
            row("trending-today", catalog),
            row("newest-local", catalog),
            row("popular-now", catalog),
            row("top-rated", catalog),
        ]);

        expect(plan.map((section) => section.items.length)).toEqual([5, 5, 5, 5]);
        expect(planHomeSections(plan)).toHaveLength(4);
    });

    it("czesciowe dopasowanie ponizej progu wraca do pelnej listy zrodlowej", () => {
        const catalog = library(12);
        const plan = applyCrossSectionDedup([
            row("trending-today", catalog.slice(0, 10)),
            row("popular-now", catalog.slice(0, 12)),
        ]);
        const byId = new Map(plan.map((section) => [section.id, section]));

        expect(keys(byId.get("popular-now"))).toHaveLength(12);
    });

    it("dopasowanie dokladnie na progu zostaje odchudzone", () => {
        const catalog = library(13);
        const plan = applyCrossSectionDedup([
            row("trending-today", catalog.slice(0, 10)),
            row("popular-now", catalog.slice(0, 13)),
        ]);
        const byId = new Map(plan.map((section) => [section.id, section]));

        expect(keys(byId.get("popular-now"))).toEqual(["S11", "S12", "S13"]);
    });

    it("grupa sezonow liczy sie jako jeden tytul", () => {
        const seasonOne = catalogSeriesFixture("Seria S1", { groupId: 7, seasonNumber: 1 });
        const seasonTwo = catalogSeriesFixture("Seria S2", { groupId: 7, seasonNumber: 2 });
        const others = library(7);
        const plan = applyCrossSectionDedup([
            row("trending-today", [seasonOne, ...others.slice(0, 4)]),
            row("popular-now", [seasonTwo, ...others]),
        ]);
        const byId = new Map(plan.map((section) => [section.id, section]));

        expect(keys(byId.get("popular-now"))).toEqual(["S5", "S6", "S7"]);
    });
});

describe("wybor tytulu do hero", () => {
    const catalog = library(4);
    const resume = {
        seriesKey: "S3",
        episodeKey: "01.mp4",
        positionSeconds: 120,
        durationSeconds: 1200,
        updatedAt: 10,
    };

    it("kontynuacja ma pierwszenstwo", () => {
        expect(selectResumeHero(catalog, resume)?.key).toBe("S3");
    });

    it("brak postepu nie wybiera nic z kontynuacji", () => {
        expect(selectResumeHero(catalog, null)).toBeNull();
    });

    it("postep na tytule bez odcinkow nie blokuje hero", () => {
        const withoutEpisodes = catalog.map((series) =>
            series.key === "S3" ? { ...series, episodes: [] } : series
        );

        expect(selectResumeHero(withoutEpisodes, resume)).toBeNull();
    });

    it("bez postepu hero bierze pierwszy lokalny tytul z trendow", () => {
        expect(selectFallbackHero(catalog, [catalog[1]!])?.key).toBe("S2");
    });

    it("bez trendow hero wraca do najnowszego tytulu", () => {
        expect(selectFallbackHero(catalog, [])?.key).toBe("S4");
    });

    it("pusty katalog nie daje tytulu do hero", () => {
        expect(selectFallbackHero([], [])).toBeNull();
    });
});
