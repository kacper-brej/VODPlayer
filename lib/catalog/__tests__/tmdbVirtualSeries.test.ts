import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset: async () => null }));
vi.mock("@/lib/metadata/tmdbConfig", () => ({ getTmdbImageBaseUrl: async () => ({ kind: "error", reason: "server" }) }));
vi.mock("@/lib/metadata/providers/tmdb", () => ({
    tmdbProvider: { getSeries: async () => ({ kind: "error", reason: "server" }) },
    getTmdbSeasonEpisodes: async () => ({ kind: "error", reason: "server" }),
    getTmdbSeasonSummaries: async () => ({ kind: "error", reason: "server" }),
}));
vi.mock("@/lib/player/videoAccess", () => ({ signedManifestUrl: () => "/hls?demo" }));

const {
    TMDB_VIRTUAL_ID_OFFSET,
    TMDB_VIRTUAL_MOVIE_ID_OFFSET,
    isVirtualTmdbKey,
    isVirtualTmdbMovieKey,
    isVirtualTmdbTvKey,
    getVirtualTmdbEpisodesResult,
    parseVirtualTmdbRef,
    virtualSeriesFromListItem,
    virtualSeriesFromMovieListItem,
    virtualTmdbKey,
    virtualTmdbMovieKey,
    virtualTmdbSeriesId,
} = await import("@/lib/catalog/tmdbVirtualSeries");

const listItem = (overrides: Record<string, unknown> = {}) => ({
    id: 1399,
    name: "Gra o tron",
    popularity: 100,
    vote_average: 8.456,
    vote_count: 1000,
    first_air_date: "2011-04-17",
    genre_ids: [18],
    overview: "Opis serialu.",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    ...overrides,
});

describe("tozsamosc wirtualnych tytulow TMDB", () => {
    it("buduje klucz i identyfikator z przesunieciem", () => {
        expect(virtualTmdbKey(1399)).toBe("tmdb:1399");
        expect(virtualTmdbSeriesId(1399)).toBe(TMDB_VIRTUAL_ID_OFFSET + 1399);
    });

    it("rozpoznaje klucz wirtualny i odrzuca lokalny", () => {
        expect(isVirtualTmdbKey("tmdb:1399")).toBe(true);
        expect(isVirtualTmdbKey("Tokyo Ghoul √A")).toBe(false);
        expect(isVirtualTmdbKey("tmdb:abc")).toBe(false);
    });

    it("odczytuje identyfikator zarowno z klucza jak i z liczby", () => {
        expect(parseVirtualTmdbRef("tmdb:1399")).toEqual({ kind: "tv", id: 1399 });
        expect(parseVirtualTmdbRef(String(TMDB_VIRTUAL_ID_OFFSET + 1399))).toEqual({ kind: "tv", id: 1399 });
    });

    it("nie przechwytuje identyfikatorow lokalnych ani spoza zakresu", () => {
        expect(parseVirtualTmdbRef("42")).toBeNull();
        expect(parseVirtualTmdbRef("1000003")).toBeNull();
        expect(parseVirtualTmdbRef("3000000")).toBeNull();
        expect(parseVirtualTmdbRef("Tokyo Ghoul √A")).toBeNull();
    });

    it("nie zamienia bledu pobierania sezonu na poprawna pusta liste", async () => {
        await expect(getVirtualTmdbEpisodesResult(1399, 2)).resolves.toEqual({
            kind: "error",
            reason: "server",
        });
    });
});

describe("kafelek z listy TMDB", () => {
    it("przenosi tytul, opis, rok i ocene", () => {
        const series = virtualSeriesFromListItem(listItem(), "https://image.tmdb.org/t/p/");

        expect(series).toMatchObject({
            key: "tmdb:1399",
            title: "Gra o tron",
            synopsis: "Opis serialu.",
            year: 2011,
            sourceRating: "8.5",
            tmdbExternalId: 1399,
        });
    });

    it("zawsze dostaje tryb pokazowy i nie ma odcinkow lokalnych", () => {
        const series = virtualSeriesFromListItem(listItem(), "https://image.tmdb.org/t/p/");

        expect(series.access).toBe("demo");
        expect(series.episodes).toEqual([]);
        expect(series.episodeCount).toBe(0);
    });

    it("sklada adresy grafik w formacie rozpoznawanym przez loader obrazow", () => {
        const series = virtualSeriesFromListItem(listItem(), "https://image.tmdb.org/t/p/");

        expect(series.posterImage).toBe("https://image.tmdb.org/t/p/w780/poster.jpg");
        expect(series.backdropImage).toBe("https://image.tmdb.org/t/p/w1280/backdrop.jpg");
        expect(series.posterImage?.startsWith("https://image.tmdb.org/t/p/")).toBe(true);
    });

    it("znosi brak bazowego adresu obrazow i brak grafik", () => {
        const withoutBase = virtualSeriesFromListItem(listItem(), null);
        const withoutArtwork = virtualSeriesFromListItem(
            listItem({ poster_path: null, backdrop_path: null }),
            "https://image.tmdb.org/t/p/",
        );

        expect(withoutBase.posterImage).toBeNull();
        expect(withoutBase.backdropImage).toBeNull();
        expect(withoutArtwork.posterImage).toBeNull();
        expect(withoutArtwork.backdropImage).toBeNull();
    });

    it("pomija ocene zerowa i pusty opis", () => {
        const series = virtualSeriesFromListItem(
            listItem({ vote_average: 0, overview: "   " }),
            "https://image.tmdb.org/t/p/",
        );

        expect(series.sourceRating).toBeNull();
        expect(series.synopsis).toBeNull();
    });
});

const movieItem = (overrides: Record<string, unknown> = {}) => ({
    id: 603,
    title: "Matrix",
    popularity: 90,
    vote_average: 8.222,
    vote_count: 500,
    release_date: "1999-03-30",
    genre_ids: [28],
    overview: "Opis filmu.",
    poster_path: "/movie-poster.jpg",
    backdrop_path: "/movie-backdrop.jpg",
    ...overrides,
});

describe("wirtualne filmy TMDB", () => {
    it("rozdziela klucze filmow i seriali", () => {
        expect(virtualTmdbMovieKey(603)).toBe("tmdb:movie:603");
        expect(isVirtualTmdbMovieKey("tmdb:movie:603")).toBe(true);
        expect(isVirtualTmdbTvKey("tmdb:movie:603")).toBe(false);
        expect(isVirtualTmdbTvKey("tmdb:603")).toBe(true);
        expect(isVirtualTmdbKey("tmdb:movie:603")).toBe(true);
    });

    it("nie myli filmu z serialem o tym samym numerze TMDB", () => {
        expect(parseVirtualTmdbRef("tmdb:movie:603")).toEqual({ kind: "movie", id: 603 });
        expect(parseVirtualTmdbRef("tmdb:603")).toEqual({ kind: "tv", id: 603 });
        expect(parseVirtualTmdbRef(String(TMDB_VIRTUAL_MOVIE_ID_OFFSET + 603)))
            .toEqual({ kind: "movie", id: 603 });

        const movie = virtualSeriesFromMovieListItem(movieItem(), null);
        const series = virtualSeriesFromListItem(listItem({ id: 603 }), null);
        expect(movie.id).not.toBe(series.id);
        expect(movie.key).not.toBe(series.key);
    });

    it("mapuje film z listy na kafelek katalogu", () => {
        const movie = virtualSeriesFromMovieListItem(
            movieItem(),
            "https://image.tmdb.org/t/p/",
            ["Akcja"],
        );

        expect(movie).toMatchObject({
            key: "tmdb:movie:603",
            title: "Matrix",
            synopsis: "Opis filmu.",
            year: 1999,
            sourceRating: "8.2",
            access: "demo",
            tmdbExternalId: 603,
        });
        expect(movie.genres).toEqual([{ name: "Akcja", slug: "akcja" }]);
        expect(movie.posterImage).toBe("https://image.tmdb.org/t/p/w780/movie-poster.jpg");
    });
});
