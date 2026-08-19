import { describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import type { ProgressReadModel } from "@/lib/progress/progressService";
import {
    buildWatchlistHomeRow,
    getPersonalizedHomeRows,
    selectRecommendationSeed,
} from "../personalizedHomeRows";

const tmdbItem = (id: number) => ({
    id,
    name: `TMDB ${id}`,
    popularity: id,
    vote_average: 8,
    vote_count: 100,
    first_air_date: null,
    genre_ids: [],
});

const catalog = Array.from({ length: 7 }, (_, index) =>
    catalogSeriesFixture(`Series ${index + 1}`, {
        id: 1_000_001 + index,
        tmdbExternalId: index === 0 ? null : index + 1,
    })
);

const progress = (
    resumes: ProgressReadModel["resumes"] = [],
    episodesBySeries: ProgressReadModel["episodesBySeries"] = {},
): ProgressReadModel => ({ resumes, episodesBySeries });

const resume = (seriesKey: string, updatedAt: number) => ({
    seriesKey,
    episodeKey: "01.mp4",
    positionSeconds: 120,
    durationSeconds: 1200,
    updatedAt,
});

const sources = ({
    watchlist = { kind: "empty" as const, data: [] },
    progressData = progress(),
    recommendations = [2, 3, 4, 5, 6, 7],
    recommendationFailure = null as "network" | null,
} = {}) => ({
    watchlist: vi.fn().mockResolvedValue(watchlist),
    progress: vi.fn().mockResolvedValue({ kind: "success", data: progressData }),
    recommendations: recommendationFailure
        ? vi.fn().mockResolvedValue({ kind: "error", reason: recommendationFailure })
        : vi.fn().mockResolvedValue({
            kind: "success",
            data: recommendations.map(tmdbItem),
        }),
});

describe("personalizowane sekcje strony glownej", () => {
    it("pomija pusta watchliste", () => {
        expect(buildWatchlistHomeRow(catalog, { kind: "empty", data: [] })).toEqual({
            kind: "omitted",
            id: "watchlist",
            source: "local-watchlist",
            reason: "empty_watchlist",
        });
    });

    it("pokazuje watchliste juz od jednej pozycji", () => {
        const row = buildWatchlistHomeRow(catalog, {
            kind: "success",
            data: [{ seriesKey: "Series 3", addedAt: 20 }],
        });

        expect(row).toMatchObject({
            kind: "ready",
            row: { items: [{ key: "Series 3" }] },
        });
    });

    it("zachowuje kolejnosc watchlisty wynikajaca z daty dodania", () => {
        const row = buildWatchlistHomeRow(catalog, {
            kind: "success",
            data: [
                { seriesKey: "Series 3", addedAt: 20 },
                { seriesKey: "Series 2", addedAt: 10 },
            ],
        });

        expect(row.kind).toBe("ready");
        if (row.kind === "ready") {
            expect(row.row.items.map((series) => series.key)).toEqual(["Series 3", "Series 2"]);
        }
    });

    it("wybiera najnowsze ziarno z TMDB ID i pomija wpis bez ID", () => {
        const resumes = [resume("Series 2", 10), resume("Series 1", 30)];

        const seed = selectRecommendationSeed(resumes, catalog);

        expect(seed).toMatchObject({ series: { key: "Series 2" }, tmdbId: 2 });
        expect(resumes.map((item) => item.seriesKey)).toEqual(["Series 2", "Series 1"]);
    });

    it("wysyla do TMDB tylko publiczne ID ziarna", async () => {
        const dependencies = sources({ progressData: progress([resume("Series 2", 20)]) });

        await getPersonalizedHomeRows(catalog, dependencies);

        expect(dependencies.recommendations).toHaveBeenCalledWith(2);
        expect(dependencies.recommendations).toHaveBeenCalledOnce();
    });

    it("pomija rekomendacje bez ziarna i nie odpytuje TMDB", async () => {
        const dependencies = sources({ progressData: progress([resume("Series 1", 20)]) });

        const rows = await getPersonalizedHomeRows(catalog, dependencies);

        expect(rows[1]).toEqual({
            kind: "omitted",
            id: "recommendations",
            source: "tmdb-recommendations",
            reason: "no_seed",
        });
        expect(dependencies.recommendations).not.toHaveBeenCalled();
    });

    it("usuwa samo ziarno i w pelni ukonczone tytuly", async () => {
        const completedEpisode = {
            positionSeconds: 1200,
            durationSeconds: 1200,
            completed: true,
            updatedAt: 30,
        };
        const dependencies = sources({
            progressData: progress(
                [resume("Series 2", 20)],
                { "Series 3": { "01.mp4": completedEpisode } },
            ),
        });

        const rows = await getPersonalizedHomeRows(catalog, dependencies);
        const recommendations = rows[1];

        expect(recommendations.kind).toBe("ready");
        if (recommendations.kind === "ready") {
            expect(recommendations.row.items.map((series) => series.key)).toEqual([
                "Series 4",
                "Series 5",
                "Series 6",
                "Series 7",
            ]);
        }
    });

    it("traktuje blad TMDB jako normalne pominiecie rekomendacji", async () => {
        const rows = await getPersonalizedHomeRows(catalog, sources({
            progressData: progress([resume("Series 2", 20)]),
            recommendationFailure: "network",
        }));

        expect(rows[1]).toEqual({
            kind: "omitted",
            id: "recommendations",
            source: "tmdb-recommendations",
            reason: "provider_unavailable",
        });
    });

    it("pomija rekomendacje z mniej niz trzema pozycjami po filtrach", async () => {
        const rows = await getPersonalizedHomeRows(catalog, sources({
            progressData: progress([resume("Series 2", 20)]),
            recommendations: [2, 3],
        }));

        expect(rows[1]).toMatchObject({
            kind: "omitted",
            reason: "insufficient_matches",
        });
    });

    it("zwraca rekomendacje nieobecna w katalogu widza jako pozycje TMDB", async () => {
        const viewerCatalog = catalog.slice(0, 5);
        const rows = await getPersonalizedHomeRows(viewerCatalog, sources({
            progressData: progress([resume("Series 2", 20)]),
            recommendations: [999, 3, 4, 5],
        }));
        const recommendations = rows[1];

        expect(recommendations.kind).toBe("ready");
        if (recommendations.kind === "ready") {
            expect(recommendations.row.items.map((series) => series.key)).toEqual([
                "tmdb:999",
                "Series 3",
                "Series 4",
                "Series 5",
            ]);
            expect(recommendations.row.items[0]).toMatchObject({ access: "demo" });
        }
    });
});
