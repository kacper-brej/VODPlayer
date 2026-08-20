import { describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import type { TmdbMovieListItem, TmdbTvListItem } from "@/lib/core/contracts";

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

describe("katalog zasilany z TMDB", () => {
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
