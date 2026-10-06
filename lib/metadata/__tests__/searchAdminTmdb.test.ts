import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ tv: vi.fn(), movies: vi.fn(), images: vi.fn() }));
vi.mock("../tmdbLists", () => ({ searchTmdbTvList: mocks.tv, searchTmdbMovieList: mocks.movies }));
vi.mock("../tmdbConfig", () => ({ getTmdbImageBaseUrl: mocks.images }));
import { searchAdminTmdb, uniqueTmdbMatch } from "../searchAdminTmdb";
import type { SeriesCandidate } from "../types";

beforeEach(() => {
    vi.clearAllMocks();
    mocks.images.mockResolvedValue({ kind: "success", data: "https://image.tmdb.org/t/p/" });
    mocks.tv.mockResolvedValue({ kind: "success", data: [{ id: 1, name: "Diuna", first_air_date: "2000-12-03", poster_path: "/tv.jpg" }] });
    mocks.movies.mockResolvedValue({ kind: "success", data: [{ id: 2, title: "Diuna", release_date: "2021-10-22", poster_path: "/movie.jpg" }] });
});
describe("wyszukiwanie TMDB w panelu", () => {
    it("zwraca filmy i seriale z pełnymi adresami plakatów", async () => {
        const result = await searchAdminTmdb("Diuna");
        expect(result).toMatchObject({ kind: "success", data: [
            { externalId: "tv:1", year: 2000, format: "TV", coverImage: "https://image.tmdb.org/t/p/w342/tv.jpg" },
            { externalId: "movie:2", year: 2021, format: "MOVIE", coverImage: "https://image.tmdb.org/t/p/w342/movie.jpg" },
        ] });
        if (result.kind !== "error") expect(uniqueTmdbMatch("Diuna", result.data)).toBeNull();
    });
    it("nie dobiera automatycznie z niepełnych wyników", async () => {
        mocks.movies.mockResolvedValue({ kind: "error", reason: "network" });
        expect(await searchAdminTmdb("Diuna")).toEqual({ kind: "error", reason: "network" });
    });
    it("pokazuje dokładnie dopasowany film przed dziesięcioma podobnymi serialami", async () => {
        mocks.tv.mockResolvedValue({ kind: "success", data: Array.from({ length: 12 }, (_, index) => ({ id: index + 1, name: `Diuna ${index + 1}`, first_air_date: null, poster_path: null })) });
        const result = await searchAdminTmdb("Diuna");
        expect(result.kind).toBe("success");
        if (result.kind !== "error") {
            expect(result.data).toHaveLength(13);
            expect(result.data[0].externalId).toBe("movie:2");
        }
    });
    it("rozpoznaje tylko jedno dokładne dopasowanie", () => {
        const candidate: SeriesCandidate = { providerId: "tmdb", externalId: "tv:1", title: "Zażółć", altTitles: [], year: 2025, format: "TV", coverImage: null };
        expect(uniqueTmdbMatch("zazolc", [candidate])).toBe(candidate);
        expect(uniqueTmdbMatch("zazolc 2", [candidate])).toBeNull();
        expect(uniqueTmdbMatch("zazolc", [candidate, { ...candidate, externalId: "movie:2" }])).toBeNull();
    });
});
