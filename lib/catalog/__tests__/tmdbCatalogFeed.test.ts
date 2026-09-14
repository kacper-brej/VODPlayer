import { describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import type { TmdbMovieListItem, TmdbTvListItem } from "@/lib/core/contracts";
import type { CatalogSeries } from "@/lib/catalog/catalog";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset: async () => null }));
vi.mock("@/lib/metadata/tmdbConfig", () => ({
    getTmdbImageBaseUrl: async () => ({ kind: "error", reason: "server" }),
    fetchTmdbResult: async () => ({ kind: "error", reason: "server" }),
}));
vi.mock("@/lib/metadata/providers/tmdb", () => ({
    tmdbProvider: { getSeries: async () => ({ kind: "error", reason: "server" }) },
    getTmdbSeasonEpisodes: async () => ({ kind: "error", reason: "server" }),
    getTmdbSeasonSummaries: async () => ({ kind: "error", reason: "server" }),
}));
vi.mock("@/lib/metadata/tmdbMovies", () => ({
    getTmdbMovie: async () => ({ kind: "error", reason: "server" }),
}));
vi.mock("@/lib/player/videoAccess", () => ({ signedManifestUrl: () => "/hls?demo" }));

const { getTmdbCatalogFeed } = await import("@/lib/catalog/tmdbCatalogFeed");

const tvItem = (id: number, name: string): TmdbTvListItem => ({
    id,
    name,
    popularity: 10,
    vote_average: 8,
    vote_count: 100,
    first_air_date: "2011-04-17",
    genre_ids: [18],
    overview: "Opis serialu.",
    poster_path: "/tv.jpg",
    backdrop_path: "/tv-backdrop.jpg",
});

const movieItem = (id: number, title: string): TmdbMovieListItem => ({
    id,
    title,
    popularity: 20,
    vote_average: 7.5,
    vote_count: 200,
    release_date: "1999-03-30",
    genre_ids: [28],
    overview: "Opis filmu.",
    poster_path: "/movie.jpg",
    backdrop_path: "/movie-backdrop.jpg",
});

const sourcesFor = ({
    tv = [] as TmdbTvListItem[],
    movies = [] as TmdbMovieListItem[],
    tvSearch = [] as TmdbTvListItem[],
    movieSearch = [] as TmdbMovieListItem[],
} = {}) => ({
    tvLists: vi.fn(async () => tv),
    movieLists: vi.fn(async () => movies),
    tvSearch: vi.fn(async () => tvSearch),
    movieSearch: vi.fn(async () => movieSearch),
    imageBaseUrl: async () => "https://image.tmdb.org/t/p/",
    genres: async (kind: "tv" | "movie") => new Map(
        kind === "tv" ? [[18, "Dramat"]] : [[28, "Akcja"]],
    ),
});

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((complete, fail) => {
        resolve = complete;
        reject = fail;
    });
    return { promise, resolve, reject };
};

describe("katalog zasilany z TMDB", () => {
    it("rozpoczyna zrodla przed katalogiem i zachowuje dopasowania, deduplikacje oraz kolejnosc", async () => {
        const pendingCatalog = deferred<readonly CatalogSeries[]>();
        const local = catalogSeriesFixture("gra-o-tron", { tmdbExternalId: 1399 });
        const sources = sourcesFor({
            tv: [tvItem(1399, "Gra o tron"), tvItem(1400, "Inny serial"), tvItem(1400, "Duplikat"), tvItem(1401, "Nastepny")],
            movies: [movieItem(603, "Matrix"), movieItem(603, "Duplikat"), movieItem(604, "Drugi film")],
        });
        const imageBaseUrl = vi.spyOn(sources, "imageBaseUrl");
        const genres = vi.spyOn(sources, "genres");
        let completed = false;
        const result = getTmdbCatalogFeed(pendingCatalog.promise, {}, sources).then((feed) => {
            completed = true;
            return feed;
        });

        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(sources.tvLists).toHaveBeenCalledOnce();
        expect(sources.movieLists).toHaveBeenCalledOnce();
        expect(imageBaseUrl).toHaveBeenCalledOnce();
        expect(genres.mock.calls).toEqual([["tv"], ["movie"]]);
        expect(completed).toBe(false);

        pendingCatalog.resolve([local]);
        const feed = await result;

        expect(feed.map((entry) => entry.key)).toEqual(["tmdb:1400", "tmdb:movie:603", "tmdb:1401", "tmdb:movie:604"]);
        expect(feed).toEqual(await getTmdbCatalogFeed([local], {}, sources));
    });

    it("obsluguje odrzucenie katalogu, gdy zrodla jeszcze trwaja", async () => {
        const pendingCatalog = deferred<readonly CatalogSeries[]>();
        const pendingTv = deferred<TmdbTvListItem[]>();
        const sources = sourcesFor();
        sources.tvLists.mockReturnValue(pendingTv.promise);
        const result = getTmdbCatalogFeed(pendingCatalog.promise, {}, sources);
        const assertion = expect(result).rejects.toThrow("catalog unavailable");

        pendingCatalog.reject(new Error("catalog unavailable"));
        await assertion;
        pendingTv.reject(new Error("late TMDB failure"));
        await new Promise<void>((resolve) => setImmediate(resolve));
    });

    it("obsluguje odrzucenie zrodla przed zakonczeniem katalogu", async () => {
        const pendingCatalog = deferred<readonly CatalogSeries[]>();
        const sources = sourcesFor();
        sources.tvLists.mockRejectedValue(new Error("TMDB unavailable"));

        await expect(getTmdbCatalogFeed(pendingCatalog.promise, {}, sources)).rejects.toThrow("TMDB unavailable");
        pendingCatalog.reject(new Error("late catalog failure"));
        await new Promise<void>((resolve) => setImmediate(resolve));
    });

    it("zwraca seriale i filmy przeplatane, z kluczami wirtualnymi", async () => {
        const feed = await getTmdbCatalogFeed(
            [],
            {},
            sourcesFor({ tv: [tvItem(1399, "Gra o tron")], movies: [movieItem(603, "Matrix")] }),
        );

        expect(feed.map((entry) => entry.key)).toEqual(["tmdb:1399", "tmdb:movie:603"]);
        expect(feed[0].genres).toEqual([{ name: "Dramat", slug: "dramat" }]);
        expect(feed[1].genres).toEqual([{ name: "Akcja", slug: "akcja" }]);
    });

    it("pomija seriale, ktore sa juz w bibliotece", async () => {
        const local = catalogSeriesFixture("gra-o-tron", { tmdbExternalId: 1399 });

        const feed = await getTmdbCatalogFeed(
            [local],
            {},
            sourcesFor({ tv: [tvItem(1399, "Gra o tron"), tvItem(1400, "Inny serial")] }),
        );

        expect(feed.map((entry) => entry.key)).toEqual(["tmdb:1400"]);
    });

    it("nie myli identyfikatora filmu z serialem z biblioteki", async () => {
        const local = catalogSeriesFixture("serial-603", { tmdbExternalId: 603 });

        const feed = await getTmdbCatalogFeed(
            [local],
            {},
            sourcesFor({ movies: [movieItem(603, "Matrix")] }),
        );

        expect(feed.map((entry) => entry.key)).toEqual(["tmdb:movie:603"]);
    });

    it("dla zapytania korzysta z wyszukiwania zamiast list", async () => {
        const sources = sourcesFor({
            tv: [tvItem(1, "Z listy")],
            movies: [movieItem(2, "Z listy")],
            tvSearch: [tvItem(1399, "Gra o tron")],
            movieSearch: [movieItem(603, "Matrix")],
        });

        const feed = await getTmdbCatalogFeed([], { query: "gra" }, sources);

        expect(sources.tvSearch).toHaveBeenCalledWith("gra");
        expect(sources.tvLists).not.toHaveBeenCalled();
        expect(sources.movieLists).not.toHaveBeenCalled();
        expect(feed.map((entry) => entry.key)).toEqual(["tmdb:1399", "tmdb:movie:603"]);
    });

    it("traktuje jednoznakowe zapytanie jak brak zapytania", async () => {
        const sources = sourcesFor({ tv: [tvItem(1399, "Gra o tron")] });

        await getTmdbCatalogFeed([], { query: "g" }, sources);

        expect(sources.tvLists).toHaveBeenCalled();
        expect(sources.tvSearch).not.toHaveBeenCalled();
    });

    it("respektuje limit pozycji", async () => {
        const feed = await getTmdbCatalogFeed(
            [],
            { limit: 3 },
            sourcesFor({
                tv: [tvItem(1, "A"), tvItem(2, "B"), tvItem(3, "C")],
                movies: [movieItem(4, "D"), movieItem(5, "E")],
            }),
        );

        expect(feed).toHaveLength(3);
        expect(feed.map((entry) => entry.key)).toEqual(["tmdb:1", "tmdb:movie:4", "tmdb:2"]);
    });

    it("zwraca pusta liste, gdy TMDB nic nie oddaje", async () => {
        const feed = await getTmdbCatalogFeed([], {}, sourcesFor());

        expect(feed).toEqual([]);
    });
});
