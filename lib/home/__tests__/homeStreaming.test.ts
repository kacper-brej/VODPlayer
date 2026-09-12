import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import { dataSuccess } from "@/lib/core/dataResult";
import type { TmdbTvListItem } from "@/lib/core/contracts";
import type { HomeRowId, HomeRowPromises, HomeRowResult } from "../homeRowTypes";
import { planHomeSections, readyHomeRows } from "../homeLayout";
import { createHomeSectionPromises } from "../homeSections";
import { startPersonalizedHomeRows } from "../personalizedHomeRows";
import { startPublicHomeRows } from "../publicHomeRows";

vi.mock("@/lib/metadata/tmdbConfig", () => ({
    getTmdbImageBaseUrl: vi.fn().mockResolvedValue({ kind: "error", reason: "not_configured" }),
}));

const catalog = Array.from({ length: 40 }, (_, index) =>
    catalogSeriesFixture(`Series ${index + 1}`, {
        id: 1_000_001 + index,
        tmdbExternalId: index + 1,
        episodes: [{
            ...catalogSeriesFixture("episode").episodes[0]!,
            addedAt: index + 1,
        }],
    }),
);

const ready = (id: HomeRowId, start: number, end: number): HomeRowResult => ({
    kind: "ready",
    row: {
        id,
        title: id,
        kicker: id,
        variant: "classic",
        source: "local-newest",
        items: catalog.slice(start, end),
    },
});

const resultId = (result: HomeRowResult): HomeRowId => result.kind === "ready" ? result.row.id : result.id;

const rowPromises = (results: HomeRowResult[]): HomeRowPromises =>
    new Map(results.map((result) => [resultId(result), Promise.resolve(result)]));

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => { resolve = complete; });
    return { promise, resolve };
};

const settledThisTurn = <T>(promise: Promise<T>) => Promise.race([
    promise.then((value) => ({ settled: true as const, value })),
    new Promise<{ settled: false }>((resolve) => setImmediate(() => resolve({ settled: false }))),
]);

const tmdbItems = (ids: number[]): TmdbTvListItem[] => ids.map((id) => ({
    id,
    name: `TMDB ${id}`,
    popularity: id,
    vote_average: 8,
    vote_count: 100,
    first_air_date: null,
    genre_ids: [],
}));

afterEach(() => {
    vi.restoreAllMocks();
});

describe("strumieniowanie sekcji strony glownej", () => {
    it("udostepnia trendy przed wolniejszymi listami i personalizacja", async () => {
        const later = deferred<ReturnType<typeof dataSuccess<TmdbTvListItem[]>>>();
        const progress = deferred<Awaited<ReturnType<NonNullable<Parameters<typeof startPersonalizedHomeRows>[1]>["progress"]>>>();
        const sources = {
            trendingToday: vi.fn().mockResolvedValue(dataSuccess(tmdbItems([1, 2, 3, 4]))),
            popularNow: vi.fn(() => later.promise),
            topRated: vi.fn(() => later.promise),
            onTheAir: vi.fn(() => later.promise),
        };
        const sections = createHomeSectionPromises(new Map([
            ...startPublicHomeRows(catalog, sources),
            ...startPersonalizedHomeRows(catalog, {
                watchlist: () => Promise.resolve(dataSuccess([])),
                progress: () => progress.promise,
                recommendations: vi.fn(),
            }),
        ]));

        const trending = await settledThisTurn(sections.get("trending-today")!);

        expect(trending).toMatchObject({ settled: true, value: { id: "trending-today" } });
        expect(await settledThisTurn(sections.get("popular-now")!)).toEqual({ settled: false });
        for (const source of Object.values(sources)) expect(source).toHaveBeenCalledOnce();

        later.resolve(dataSuccess(tmdbItems([5, 6, 7, 8])));
        progress.resolve(dataSuccess({ resumes: [], episodesBySeries: {} }));
        await Promise.all(sections.values());
    });

    it("lokalne nowosci i lista widza nie czekaja na trendy", async () => {
        const trending = deferred<HomeRowResult>();
        const sections = createHomeSectionPromises(new Map([
            ["trending-today", trending.promise],
            ["newest-local", Promise.resolve(ready("newest-local", 0, 5))],
            ["watchlist", Promise.resolve(ready("watchlist", 2, 3))],
        ]));

        expect(await settledThisTurn(sections.get("newest-local")!)).toMatchObject({ settled: true });
        expect(await settledThisTurn(sections.get("watchlist")!)).toMatchObject({ settled: true });

        trending.resolve(ready("trending-today", 0, 4));
        await Promise.all(sections.values());
    });

    it.each([5, 12, 40])("zachowuje wynik planowania oraz fallback przy bibliotece %i tytulow", async (size) => {
        const results = [
            ready("on-the-air", 0, size),
            ready("watchlist", 0, 2),
            ready("top-rated", 4, size),
            ready("newest-local", 5, Math.min(15, size)),
            ready("trending-today", 0, Math.min(10, size)),
            ready("recommendations", 0, Math.min(30, size)),
            ready("popular-now", 3, Math.min(25, size)),
        ];
        const actual = (await Promise.all(createHomeSectionPromises(rowPromises(results)).values()))
            .filter((section) => section !== undefined);

        expect(actual).toEqual(planHomeSections(readyHomeRows(results)));
    });

    it("odrzucone zrodlo nie usuwa pozostalych sekcji", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const newest = ready("newest-local", 0, 5);
        const popular = ready("popular-now", 0, 8);
        const sections = createHomeSectionPromises(new Map([
            ["trending-today", Promise.reject(new Error("provider unavailable"))],
            ["newest-local", Promise.resolve(newest)],
            ["popular-now", Promise.resolve(popular)],
        ]));

        expect((await Promise.all(sections.values())).filter((section) => section !== undefined))
            .toEqual(planHomeSections(readyHomeRows([newest, popular])));
        expect(log).toHaveBeenCalledOnce();
    });

    it("wspoldzieli pobieranie zrodel miedzy hero, rzedem i pelnym planem", async () => {
        const source = () => vi.fn().mockResolvedValue(dataSuccess(tmdbItems([1, 2, 3, 4])));
        const sources = {
            trendingToday: source(),
            popularNow: source(),
            topRated: source(),
            onTheAir: source(),
        };
        const sections = createHomeSectionPromises(startPublicHomeRows(catalog, sources));

        const [hero, row] = await Promise.all([
            sections.get("trending-today"),
            sections.get("trending-today"),
            Promise.all(sections.values()),
        ]);

        expect(hero).toBe(row);
        for (const loader of Object.values(sources)) expect(loader).toHaveBeenCalledOnce();
    });

    it("rekomendacje nie czekaja na watchliste zwolniona z deduplikacji", async () => {
        const watchlist = deferred<HomeRowResult>();
        const sections = createHomeSectionPromises(new Map([
            ["trending-today", Promise.resolve(ready("trending-today", 0, 4))],
            ["popular-now", Promise.resolve(ready("popular-now", 4, 8))],
            ["watchlist", watchlist.promise],
            ["recommendations", Promise.resolve(ready("recommendations", 8, 12))],
        ]));

        expect(await settledThisTurn(sections.get("recommendations")!)).toMatchObject({ settled: true });

        watchlist.resolve(ready("watchlist", 0, 4));
        await Promise.all(sections.values());
    });
});
