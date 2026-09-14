import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import type { AuthUser, ResumePoint, WatchlistItem } from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";

const dependencies = vi.hoisted(() => ({
    catalog: vi.fn(),
    user: vi.fn(),
    resume: vi.fn(),
    watchlist: vi.fn(),
    feed: vi.fn(),
    saved: vi.fn(),
}));

vi.mock("@/lib/catalog/catalog", () => ({ getCatalog: dependencies.catalog }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: dependencies.user }));
vi.mock("@/lib/progress/continueWatching", () => ({ getResumeMap: dependencies.resume }));
vi.mock("@/lib/watchlist/watchlist", () => ({ getWatchlist: dependencies.watchlist }));
vi.mock("@/lib/catalog/tmdbCatalogFeed", () => ({ getTmdbCatalogFeed: dependencies.feed }));
vi.mock("@/lib/catalog/savedCatalogSeries", () => ({ resolveSavedCatalogSeries: dependencies.saved }));
vi.mock("@/lib/player/videoAccess", () => ({ resolvePreviewSource: () => null }));
vi.mock("@/components/series/CatalogFilterBar", () => ({ default: "catalog-filter" }));
vi.mock("@/components/series/CatalogGrid", () => ({ default: "catalog-grid" }));
vi.mock("@/components/series/SeriesCard", () => ({ default: "series-card" }));
vi.mock("@/components/data/DataState", () => ({ DataErrorState: "data-error" }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("lucide-react", () => ({ ArrowUpRight: "arrow-icon" }));
vi.mock("@/lib/search", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/search")>();
    return { ...original, prepareSearchEntries: vi.fn(original.prepareSearchEntries) };
});

const { default: CatalogScreen } = await import("@/components/series/CatalogScreen");
const { prepareSearchEntries } = await import("@/lib/search");

const user: AuthUser = { id: 1, username: "viewer", email: "viewer@example.test", role: "viewer", onboardedAt: "2026-01-01" };
const local = catalogSeriesFixture("local", { title: "Lokalny tytul" });
const virtual = catalogSeriesFixture("tmdb:10", { id: 10, title: "Wirtualny tytul" });

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

const propsFor = (node: ReactNode, type: string): Record<string, unknown>[] => {
    if (Array.isArray(node)) return node.flatMap((child) => propsFor(child, type));
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return [
        ...(node.type === type ? [node.props] : []),
        ...propsFor(node.props.children, type),
    ];
};

const cardsFor = (node: ReactNode) => propsFor(node, "series-card").map((props) => props.item as {
    seriesKey: string;
    inWatchlist: boolean;
    positionSeconds?: number;
});

beforeEach(() => {
    vi.clearAllMocks();
    dependencies.catalog.mockResolvedValue(dataSuccess([local]));
    dependencies.user.mockResolvedValue(user);
    dependencies.resume.mockResolvedValue(dataSuccess(new Map()));
    dependencies.watchlist.mockResolvedValue(dataSuccess([]));
    dependencies.feed.mockImplementation(async (catalog: Promise<readonly CatalogSeries[]>) => {
        await catalog;
        return [virtual];
    });
    dependencies.saved.mockResolvedValue({ series: [local], unavailableKeys: [] });
});

describe("rownolegle wczytywanie katalogu", () => {
    it.each(["all", "genres"] as const)("rozpoczyna TMDB w trybie %s przed katalogiem i danymi widza", async (mode) => {
        const pendingCatalog = deferred<DataResult<CatalogSeries[]>>();
        const pendingResume = deferred<DataResult<Map<string, ResumePoint>>>();
        const pendingWatchlist = deferred<DataResult<WatchlistItem[]>>();
        dependencies.catalog.mockReturnValue(pendingCatalog.promise);
        dependencies.resume.mockReturnValue(pendingResume.promise);
        dependencies.watchlist.mockReturnValue(pendingWatchlist.promise);
        let completed = false;
        const screen = CatalogScreen({ mode, basePath: "/explore", searchParams: Promise.resolve({ q: " tytul " }) }).then((tree) => {
            completed = true;
            return tree;
        });

        await nextTurn();

        expect(dependencies.feed).toHaveBeenCalledExactlyOnceWith(expect.any(Promise), { query: "tytul" });
        expect(dependencies.catalog).toHaveBeenCalledExactlyOnceWith(false);
        expect(dependencies.resume).toHaveBeenCalledOnce();
        expect(dependencies.watchlist).toHaveBeenCalledOnce();
        expect(completed).toBe(false);

        pendingCatalog.resolve(dataSuccess([local]));
        pendingResume.resolve(dataSuccess(new Map()));
        pendingWatchlist.resolve(dataSuccess([]));

        expect(cardsFor(await screen).map((card) => card.seriesKey)).toEqual(["local", "tmdb:10"]);
        expect(dependencies.feed).toHaveBeenCalledOnce();
    });

    it("czeka na potwierdzenie sesji przed rozpoczeciem TMDB", async () => {
        const pendingUser = deferred<AuthUser | null>();
        const pendingCatalog = deferred<DataResult<CatalogSeries[]>>();
        dependencies.user.mockReturnValue(pendingUser.promise);
        dependencies.catalog.mockReturnValue(pendingCatalog.promise);
        const screen = CatalogScreen({ mode: "all", basePath: "/explore", searchParams: Promise.resolve({}) });

        await nextTurn();
        expect(dependencies.feed).not.toHaveBeenCalled();

        pendingUser.resolve(user);
        await nextTurn();
        expect(dependencies.feed).toHaveBeenCalledOnce();

        pendingCatalog.resolve(dataSuccess([local]));
        await screen;
    });

    it("nie uruchamia TMDB bez zalogowanego widza", async () => {
        dependencies.user.mockResolvedValue(null);

        const screen = await CatalogScreen({ mode: "all", basePath: "/explore", searchParams: Promise.resolve({}) });

        expect(dependencies.feed).not.toHaveBeenCalled();
        expect(cardsFor(screen).map((card) => card.seriesKey)).toEqual(["local"]);
    });

    it.each(["recent", "watchlist"] as const)("nie pobiera TMDB dla trybu %s", async (mode) => {
        const screen = await CatalogScreen({ mode, basePath: "/explore", searchParams: Promise.resolve({}) });

        expect(dependencies.feed).not.toHaveBeenCalled();
        expect(cardsFor(screen).map((card) => card.seriesKey)).toEqual(["local"]);
        expect(dependencies.saved).toHaveBeenCalledTimes(mode === "watchlist" ? 1 : 0);
    });

    it("pokazuje blad katalogu bez oczekiwania na TMDB i obsluguje pozniejsze odrzucenie", async () => {
        const pendingFeed = deferred<CatalogSeries[]>();
        dependencies.feed.mockReturnValue(pendingFeed.promise);
        dependencies.catalog.mockResolvedValue(dataFailure("server"));

        const screen = await CatalogScreen({ mode: "all", basePath: "/explore", searchParams: Promise.resolve({}) });

        expect(propsFor(screen, "data-error")[0]?.reason).toBe("server");
        expect(cardsFor(screen)).toEqual([]);
        pendingFeed.reject(new Error("late TMDB failure"));
        await nextTurn();
    });

    it("zachowuje lokalne wyniki po bledach danych widza", async () => {
        dependencies.resume.mockResolvedValue(dataFailure("server"));
        dependencies.watchlist.mockResolvedValue(dataFailure("server"));

        const screen = await CatalogScreen({ mode: "all", basePath: "/explore", searchParams: Promise.resolve({}) });

        expect(cardsFor(screen).map((card) => [card.seriesKey, card.inWatchlist, card.positionSeconds])).toEqual([
            ["local", false, undefined],
            ["tmdb:10", false, undefined],
        ]);
    });

    it("zachowuje stan bledu mojej listy", async () => {
        dependencies.watchlist.mockResolvedValue(dataFailure("unauthorized"));

        const screen = await CatalogScreen({ mode: "watchlist", basePath: "/watchlist", searchParams: Promise.resolve({}) });

        expect(propsFor(screen, "data-error")[0]?.reason).toBe("unauthorized");
        expect(dependencies.saved).not.toHaveBeenCalled();
    });

    it("obsluguje odrzucenie TMDB przed katalogiem bez zmiany propagacji bledu", async () => {
        const pendingCatalog = deferred<DataResult<CatalogSeries[]>>();
        dependencies.catalog.mockReturnValue(pendingCatalog.promise);
        dependencies.feed.mockRejectedValue(new Error("TMDB unavailable"));
        const screen = CatalogScreen({ mode: "all", basePath: "/explore", searchParams: Promise.resolve({}) });
        const assertion = expect(screen).rejects.toThrow("TMDB unavailable");

        await nextTurn();
        pendingCatalog.resolve(dataSuccess([local]));
        await assertion;
    });
});

describe("filtrowanie i stronicowanie katalogu", () => {
    it.each([{}, { q: "   " }])("pomija indeks wyszukiwania dla pustej frazy %j", async (searchParams) => {
        const catalog = Array.from({ length: 30 }, (_, index) => catalogSeriesFixture(`local-${index}`, {
            title: `Tytul ${String(30 - index).padStart(2, "0")}`,
            genres: [{ name: "Dramat", slug: "dramat" }],
        }));
        dependencies.catalog.mockResolvedValue(dataSuccess(catalog));
        const screen = await CatalogScreen({
            mode: "all",
            basePath: "/explore",
            searchParams: Promise.resolve({ ...searchParams, genre: "dramat", sort: "title" }),
        });

        expect(prepareSearchEntries).not.toHaveBeenCalled();
        expect(cardsFor(screen).map((card) => card.seriesKey)).toEqual(
            Array.from({ length: 24 }, (_, index) => `local-${29 - index}`),
        );
        expect(propsFor(screen, "a").some((props) => props.href === "/explore?sort=title&genre=dramat&page=2")).toBe(true);
    });

    it("zachowuje dopasowanie tytulow alternatywnych, dane widza i kolejna strone", async () => {
        const catalog = Array.from({ length: 30 }, (_, index) => catalogSeriesFixture(`local-${index}`, {
            title: `Tytul ${String(index + 1).padStart(2, "0")}`,
            altTitles: ["Matrix"],
            genres: [{ name: "Dramat", slug: "dramat" }],
        }));
        dependencies.catalog.mockResolvedValue(dataSuccess(catalog));
        dependencies.watchlist.mockResolvedValue(dataSuccess([{ seriesKey: "local-0", addedAt: 20 }]));
        dependencies.resume.mockResolvedValue(dataSuccess(new Map([["local-0", {
            seriesKey: "local-0", episodeKey: "01.mp4", positionSeconds: 120, durationSeconds: 1200, updatedAt: 20,
        }]])));
        const screen = await CatalogScreen({
            mode: "all",
            basePath: "/explore",
            searchParams: Promise.resolve({ q: " matrix ", genre: "dramat", sort: "title", page: "2" }),
        });

        expect(prepareSearchEntries).toHaveBeenCalledOnce();
        expect(cardsFor(screen).map((card) => card.seriesKey)).toEqual(catalog.map((series) => series.key));
        expect(cardsFor(screen)[0]).toMatchObject({ inWatchlist: true, positionSeconds: 120 });
        expect(propsFor(screen, "p").filter((props) => Array.isArray(props.children) && props.children[0] === "Matrix")).toHaveLength(30);
        expect(propsFor(screen, "a").some((props) => String(props.href).includes("page=3"))).toBe(false);
    });
});
