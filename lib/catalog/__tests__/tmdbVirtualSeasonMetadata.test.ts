import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset: async () => null }));
vi.mock("@/lib/metadata/tmdbConfig", () => ({
    getTmdbImageBaseUrl: async () => ({ kind: "success", data: "https://image.tmdb.org/t/p/" }),
}));
vi.mock("@/lib/metadata/providers/tmdb", () => ({
    tmdbProvider: { getSeries: async () => ({ kind: "error", reason: "server" }) },
    getTmdbSeasonEpisodes: async () => ({ kind: "error", reason: "server" }),
    getTmdbSeasonSummaries: async () => ({
        kind: "success",
        data: [{
            season_number: 2,
            name: "Elita zabójców",
            episode_count: 8,
            air_date: "2023-12-14",
            overview: "Opis drugiego sezonu.",
            vote_average: 8.05,
        }],
    }),
}));
vi.mock("@/lib/player/videoAccess", () => ({ signedManifestUrl: () => "/hls?demo" }));

const { getVirtualTmdbSeasons } = await import("@/lib/catalog/tmdbVirtualSeries");

describe("metadane sezonu TMDB", () => {
    it("przenosi rok, opis i ocene konkretnego sezonu", async () => {
        await expect(getVirtualTmdbSeasons(108978)).resolves.toEqual([{
            number: 2,
            label: "Elita zabójców",
            episodeCount: 8,
            year: 2023,
            synopsis: "Opis drugiego sezonu.",
            rating: "8.1",
        }]);
    });
});
