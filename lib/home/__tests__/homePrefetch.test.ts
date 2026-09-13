import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import type { AuthUser, TmdbTvListItem } from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { getHomeRowSections, preloadHomeRowSections } from "../homeSections";
import { planHomeSections, readyHomeRows } from "../homeLayout";
import { getPersonalizedHomeRows } from "../personalizedHomeRows";
import { getPublicHomeRows } from "../publicHomeRows";

const dependencies = vi.hoisted(() => ({
    catalog: vi.fn(),
    user: vi.fn(),
    trendingToday: vi.fn(),
    popularNow: vi.fn(),
    topRated: vi.fn(),
    onTheAir: vi.fn(),
    imageBaseUrl: vi.fn(),
    watchlist: vi.fn(),
    progress: vi.fn(),
    recommendations: vi.fn(),
}));

vi.mock("@/lib/catalog/catalog", () => ({ getCatalog: dependencies.catalog }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: dependencies.user }));
vi.mock("@/lib/metadata/tmdbConfig", () => ({ getTmdbImageBaseUrl: dependencies.imageBaseUrl }));
vi.mock("@/lib/metadata/tmdbLists", () => ({
    getTmdbTrendingTv: dependencies.trendingToday,
    getTmdbPopularTv: dependencies.popularNow,
    getTmdbTopRatedTv: dependencies.topRated,
    getTmdbOnTheAirTv: dependencies.onTheAir,
    getTmdbRecommendations: dependencies.recommendations,
}));
vi.mock("@/lib/watchlist/watchlist", () => ({ getWatchlist: dependencies.watchlist }));
vi.mock("@/lib/progress/continueWatching", () => ({ getViewerProgressSnapshot: dependencies.progress }));

const catalog = Array.from({ length: 30 }, (_, index) =>
    catalogSeriesFixture(`Series ${index + 1}`, {
        id: 1_000_001 + index,
        tmdbExternalId: index + 1,
    }),
);

const user: AuthUser = { id: 1, username: "viewer", email: "viewer@example.test", role: "viewer", onboardedAt: "2026-01-01" };

const tmdbItems = (start: number, end: number): TmdbTvListItem[] =>
    Array.from({ length: end - start + 1 }, (_, index) => ({
        id: start + index,
        name: `TMDB ${start + index}`,
        popularity: start + index,
        vote_average: 8,
        vote_count: 100,
        first_air_date: null,
        genre_ids: [],
    }));

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((complete, fail) => {
        resolve = complete;
        reject = fail;
    });
    return { promise, resolve, reject };
};

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
    vi.resetAllMocks();
    dependencies.user.mockResolvedValue(user);
    dependencies.catalog.mockResolvedValue(dataSuccess(catalog));
    dependencies.imageBaseUrl.mockResolvedValue(dataFailure("not_configured"));
    dependencies.trendingToday.mockResolvedValue(dataSuccess(tmdbItems(1, 10)));
    dependencies.popularNow.mockResolvedValue(dataSuccess(tmdbItems(5, 24)));
    dependencies.topRated.mockResolvedValue(dataSuccess(tmdbItems(11, 30)));
    dependencies.onTheAir.mockResolvedValue(dataSuccess(tmdbItems(1, 20)));
    dependencies.watchlist.mockResolvedValue(dataSuccess([{ seriesKey: "Series 3", addedAt: 20 }]));
    dependencies.progress.mockResolvedValue(dataSuccess({
        resumes: [{ seriesKey: "Series 2", episodeKey: "01.mp4", positionSeconds: 120, durationSeconds: 1200, updatedAt: 20 }],
        episodesBySeries: {},
    }));
    dependencies.recommendations.mockResolvedValue(dataSuccess(tmdbItems(2, 21)));
});

describe("wczesne pobieranie sekcji strony glownej", () => {
    it("uruchamia TMDB i odczyty widza przed gotowoscia katalogu, zachowujac plan", async () => {
        const pendingCatalog = deferred<DataResult<CatalogSeries[]>>();
        dependencies.catalog.mockReturnValue(pendingCatalog.promise);
        let completed = false;
        const result = getHomeRowSections().then((sections) => {
            completed = true;
            return sections;
        });

        await nextTurn();

        expect(dependencies.catalog).toHaveBeenCalledWith(false);
        for (const name of ["trendingToday", "popularNow", "topRated", "onTheAir", "watchlist", "progress"] as const) {
            expect(dependencies[name]).toHaveBeenCalledOnce();
        }
        expect(dependencies.recommendations).not.toHaveBeenCalled();
        expect(completed).toBe(false);

        pendingCatalog.resolve(dataSuccess(catalog));
        const sections = await result;
        expect(dependencies.recommendations).toHaveBeenCalledExactlyOnceWith(2);

        const rows = (await Promise.all([
            getPublicHomeRows(catalog),
            getPersonalizedHomeRows(catalog),
        ])).flat();
        expect([...sections.values()]).toEqual(planHomeSections(readyHomeRows(rows)));
    });

    it("czeka na potwierdzenie sesji przed rozpoczeciem pobierania sekcji", async () => {
        const pendingUser = deferred<AuthUser | null>();
        dependencies.user.mockReturnValue(pendingUser.promise);
        const pending = preloadHomeRowSections();

        await nextTurn();

        expect(dependencies.catalog).not.toHaveBeenCalled();
        expect(dependencies.trendingToday).not.toHaveBeenCalled();
        expect(dependencies.watchlist).not.toHaveBeenCalled();

        pendingUser.resolve(user);
        await pending;

        expect(dependencies.trendingToday).toHaveBeenCalledOnce();
    });

    it("nie uruchamia zadnych zrodel bez zalogowanego widza", async () => {
        dependencies.user.mockResolvedValue(null);

        await preloadHomeRowSections();
        expect(await getHomeRowSections()).toEqual(new Map());

        for (const [name, source] of Object.entries(dependencies)) {
            if (name !== "user") expect(source).not.toHaveBeenCalled();
        }
    });

    it("obsluguje odrzucenie zrodla zanim zakonczy sie wczytywanie katalogu", async () => {
        const pendingCatalog = deferred<DataResult<CatalogSeries[]>>();
        dependencies.catalog.mockReturnValue(pendingCatalog.promise);
        dependencies.trendingToday.mockRejectedValue(new Error("TMDB unavailable"));
        dependencies.watchlist.mockRejectedValue(new Error("watchlist unavailable"));
        const result = getHomeRowSections();

        await nextTurn();
        pendingCatalog.resolve(dataSuccess(catalog));
        const sections = await result;

        expect(sections.has("trending-today")).toBe(false);
        expect(sections.has("watchlist")).toBe(false);
        expect(sections.has("popular-now")).toBe(true);
        expect(sections.has("newest-local")).toBe(true);
    });

    it("zachowuje wirtualne tytuly gdy katalog zwraca blad", async () => {
        dependencies.catalog.mockResolvedValue(dataFailure("server"));

        const sections = await getHomeRowSections();

        expect(sections.has("newest-local")).toBe(false);
        expect(sections.get("trending-today")?.items).toHaveLength(10);
        expect(sections.get("trending-today")?.items.every((series) => series.key.startsWith("tmdb:"))).toBe(true);
    });

    it("bezpiecznie konczy preload po odrzuceniu katalogu", async () => {
        const pendingCatalog = deferred<DataResult<CatalogSeries[]>>();
        dependencies.catalog.mockReturnValue(pendingCatalog.promise);
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const pending = preloadHomeRowSections();

        await nextTurn();
        pendingCatalog.reject(new Error("catalog unavailable"));

        await expect(pending).resolves.toBeUndefined();
        expect(log).toHaveBeenCalled();
        log.mockRestore();
    });
});
