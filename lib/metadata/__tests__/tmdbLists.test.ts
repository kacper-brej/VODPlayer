import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchTmdbResult } = vi.hoisted(() => ({
    fetchTmdbResult: vi.fn(),
}));

vi.mock("@/lib/metadata/tmdbConfig", () => ({ fetchTmdbResult }));

const {
    getTmdbOnTheAirTv,
    getTmdbPopularTv,
    getTmdbRecommendations,
    getTmdbTopRatedTv,
    getTmdbTrendingTv,
    TMDB_TV_LIST_CACHE_TTL_MS,
} = await import("../tmdbLists");

const item = {
    id: 1399,
    name: "Gra o tron",
    popularity: 250.5,
    vote_average: 8.5,
    vote_count: 24_000,
    first_air_date: "2011-04-17",
    genre_ids: [18, 10765],
};

const response = (results: unknown[] = [item]) => ({
    page: 1,
    results,
    total_pages: results.length === 0 ? 0 : 1,
    total_results: results.length,
});

beforeEach(() => {
    vi.clearAllMocks();
    fetchTmdbResult.mockResolvedValue({ kind: "success", data: response() });
});

describe("listy telewizyjne TMDB", () => {
    it.each([
        [
            "trending dzienny",
            () => getTmdbTrendingTv("day"),
            "/trending/tv/day?language=pl-PL",
            TMDB_TV_LIST_CACHE_TTL_MS.trendingDay,
        ],
        [
            "trending tygodniowy",
            () => getTmdbTrendingTv("week"),
            "/trending/tv/week?language=pl-PL",
            TMDB_TV_LIST_CACHE_TTL_MS.trendingWeek,
        ],
        [
            "popularne",
            getTmdbPopularTv,
            "/tv/popular?language=pl-PL",
            TMDB_TV_LIST_CACHE_TTL_MS.popular,
        ],
        [
            "najwyzej oceniane",
            getTmdbTopRatedTv,
            "/tv/top_rated?language=pl-PL",
            TMDB_TV_LIST_CACHE_TTL_MS.topRated,
        ],
        [
            "aktualnie emitowane",
            getTmdbOnTheAirTv,
            "/tv/on_the_air?language=pl-PL&timezone=Europe%2FWarsaw",
            TMDB_TV_LIST_CACHE_TTL_MS.onTheAir,
        ],
        [
            "rekomendacje",
            () => getTmdbRecommendations(1399),
            "/tv/1399/recommendations?language=pl-PL",
            TMDB_TV_LIST_CACHE_TTL_MS.recommendations,
        ],
    ])("pobiera %s z odpowiednim TTL", async (_name, run, path, cacheTtlMs) => {
        await expect(run()).resolves.toEqual({ kind: "success", data: [item] });

        expect(fetchTmdbResult).toHaveBeenCalledOnce();
        expect(fetchTmdbResult).toHaveBeenCalledWith(
            path,
            expect.any(Function),
            { cacheTtlMs },
        );

        const validator = fetchTmdbResult.mock.calls[0]?.[1];
        expect(validator(response())).toBe(true);
    });

    it("zwraca empty dla poprawnej pustej listy", async () => {
        fetchTmdbResult.mockResolvedValueOnce({ kind: "success", data: response([]) });

        await expect(getTmdbPopularTv()).resolves.toEqual({ kind: "empty", data: [] });
    });

    it("normalizuje pusta date pierwszej emisji do null", async () => {
        fetchTmdbResult.mockResolvedValueOnce({
            kind: "success",
            data: response([{ ...item, first_air_date: "" }]),
        });

        const result = await getTmdbPopularTv();

        expect(result).toMatchObject({
            kind: "success",
            data: [{ first_air_date: null }],
        });
    });

    it("akceptuje nullable first_air_date", async () => {
        fetchTmdbResult.mockResolvedValueOnce({
            kind: "success",
            data: response([{ ...item, first_air_date: null }]),
        });

        const result = await getTmdbPopularTv();

        expect(result).toMatchObject({
            kind: "success",
            data: [{ first_air_date: null }],
        });
    });

    it("nie traktuje odpowiedzi bez results jak pustej listy", async () => {
        fetchTmdbResult.mockResolvedValueOnce({
            kind: "success",
            data: { page: 1, total_pages: 0, total_results: 0 },
        });

        await expect(getTmdbPopularTv()).resolves.toEqual({
            kind: "error",
            reason: "invalid_response",
        });
    });

    it("odrzuca niepoprawny ksztalt odpowiedzi z cache lub providera", async () => {
        fetchTmdbResult.mockResolvedValueOnce({
            kind: "success",
            data: response([{ ...item, vote_average: 11 }]),
        });

        await expect(getTmdbTopRatedTv()).resolves.toEqual({
            kind: "error",
            reason: "invalid_response",
        });
    });

    it.each([
        { kind: "error", reason: "not_configured" },
        { kind: "error", reason: "network" },
        { kind: "error", reason: "server", status: 429 },
    ])("przekazuje blad TMDB bez zamiany na pusta liste", async (failure) => {
        fetchTmdbResult.mockResolvedValueOnce(failure);

        await expect(getTmdbOnTheAirTv()).resolves.toEqual(failure);
    });

    it("nie myli odrzuconego tokenu TMDB z sesja uzytkownika", async () => {
        fetchTmdbResult.mockResolvedValueOnce({
            kind: "error",
            reason: "unauthorized",
            status: 401,
        });

        await expect(getTmdbPopularTv()).resolves.toEqual({
            kind: "error",
            reason: "server",
            status: 401,
        });
    });

    it("nie wysyla zapytania dla niepoprawnego okna trending", async () => {
        await expect(getTmdbTrendingTv("month" as "day")).resolves.toEqual({
            kind: "error",
            reason: "invalid_response",
        });
        expect(fetchTmdbResult).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.NaN])(
        "nie wysyla zapytania dla niepoprawnego TMDB ID: %s",
        async (tmdbId) => {
            await expect(getTmdbRecommendations(tmdbId)).resolves.toEqual({
                kind: "error",
                reason: "invalid_response",
            });
            expect(fetchTmdbResult).not.toHaveBeenCalled();
        },
    );

    it("uzywa osobnego klucza cache dla kazdego TMDB ID rekomendacji", async () => {
        await getTmdbRecommendations(1399);
        await getTmdbRecommendations(1402);

        expect(fetchTmdbResult.mock.calls.map(([path]) => path)).toEqual([
            "/tv/1399/recommendations?language=pl-PL",
            "/tv/1402/recommendations?language=pl-PL",
        ]);
    });
});
