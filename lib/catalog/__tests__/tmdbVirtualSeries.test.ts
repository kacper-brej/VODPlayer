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
    isVirtualTmdbKey,
    parseVirtualTmdbRef,
    virtualSeriesFromListItem,
    virtualTmdbKey,
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
        expect(parseVirtualTmdbRef("tmdb:1399")).toBe(1399);
        expect(parseVirtualTmdbRef(String(TMDB_VIRTUAL_ID_OFFSET + 1399))).toBe(1399);
    });

    it("nie przechwytuje identyfikatorow lokalnych ani spoza zakresu", () => {
        expect(parseVirtualTmdbRef("42")).toBeNull();
        expect(parseVirtualTmdbRef("1000003")).toBeNull();
        expect(parseVirtualTmdbRef("3000000")).toBeNull();
        expect(parseVirtualTmdbRef("Tokyo Ghoul √A")).toBeNull();
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
