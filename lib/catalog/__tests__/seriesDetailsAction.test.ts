import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "./catalogSeriesFixture";
import { dataEmpty, dataFailure, dataSuccess } from "@/lib/core/dataResult";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    resolveCatalogSeries: vi.fn(),
    getSeriesProgressAction: vi.fn(),
    resolveSeriesIdentity: vi.fn(),
    persistSeriesIdentity: vi.fn(),
    invalidateCatalogCache: vi.fn(),
    fetchJikanRaw: vi.fn(),
    after: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/catalog/catalog", () => ({ resolveCatalogSeries: mocks.resolveCatalogSeries }));
vi.mock("@/lib/catalog/tmdbVirtualSeries", () => ({ isVirtualTmdbKey: (key: string) => key.startsWith("tmdb:") }));
vi.mock("@/lib/progress/getProgressAction", () => ({ getSeriesProgressAction: mocks.getSeriesProgressAction }));
vi.mock("@/lib/metadata/registry", () => ({ resolveSeriesIdentity: mocks.resolveSeriesIdentity }));
vi.mock("@/lib/metadata/persistIdentity", () => ({ persistSeriesIdentity: mocks.persistSeriesIdentity }));
vi.mock("@/lib/catalog/seriesMetadata", () => ({ invalidateCatalogCache: mocks.invalidateCatalogCache }));
vi.mock("@/lib/metadata/providers/jikan", () => ({ fetchJikanRaw: mocks.fetchJikanRaw }));

import getSeriesDetailsAction from "@/lib/catalog/getSeriesDetailsAction";

const providerSeries = {
    providerId: "jikan",
    externalId: "20",
    malId: 20,
    titles: { primary: "Series", romaji: null, english: "Series", native: null },
    synonyms: [],
    synopsis: "Provider synopsis",
    score: 8.5,
    ageRating: null,
    year: 2024,
    genres: [],
    studio: null,
};
const artwork = [{ kind: "backdrop", url: "/provider-banner.jpg", width: 1280, height: 720, language: null }];

beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: 9, username: "viewer" });
    mocks.resolveCatalogSeries.mockImplementation(async (_query: string, includePlaybackUrls: boolean) => {
        const series = catalogSeriesFixture("series", { hasMetadata: false });
        series.episodes[0].url = includePlaybackUrls ? "/signed-playback" : null;
        return dataSuccess(series);
    });
    mocks.getSeriesProgressAction.mockResolvedValue(dataSuccess({
        episodes: { "01.mp4": { positionSeconds: 600, durationSeconds: 1200, completed: false } },
        resume: { episodeKey: "01.mp4", positionSeconds: 600, durationSeconds: 1200 },
    }));
    mocks.resolveSeriesIdentity.mockResolvedValue(dataSuccess({
        kind: "matched", providerId: "jikan", externalId: "20", series: providerSeries, artwork,
    }));
    mocks.persistSeriesIdentity.mockResolvedValue(true);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("series details loading", () => {
    it("authenticates before reading the catalog or private progress", async () => {
        mocks.getSessionUser.mockResolvedValue(null);

        expect(await getSeriesDetailsAction(1_000_001, false)).toEqual(dataFailure("unauthorized", 401));
        expect(mocks.resolveCatalogSeries).not.toHaveBeenCalled();
        expect(mocks.getSeriesProgressAction).not.toHaveBeenCalled();
        expect(mocks.resolveSeriesIdentity).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid identifier %s before catalog access", async (id) => {
        expect(await getSeriesDetailsAction(id, false)).toEqual(dataEmpty(null));
        expect(mocks.resolveCatalogSeries).not.toHaveBeenCalled();
    });

    it("returns local episodes and current progress without metadata enrichment or playback signing", async () => {
        const result = await getSeriesDetailsAction(1_000_001, false);

        expect(result).toMatchObject({ kind: "success", data: {
            seriesKey: "series",
            metadataPending: true,
            hasSynopsis: false,
            resumeEpisodeKey: "01.mp4",
            episodes: [{ key: "01.mp4", url: null, positionSeconds: 600, percent: 50, watched: false }],
        } });
        expect(mocks.resolveCatalogSeries).toHaveBeenCalledWith("1000001", false);
        expect(mocks.getSeriesProgressAction).toHaveBeenCalledWith("series");
        expect(mocks.resolveSeriesIdentity).not.toHaveBeenCalled();
        expect(mocks.fetchJikanRaw).not.toHaveBeenCalled();
        expect(mocks.persistSeriesIdentity).not.toHaveBeenCalled();
        expect(mocks.after).not.toHaveBeenCalled();
    });

    it("reads progress again on reopening and preserves explicit completion decisions", async () => {
        await getSeriesDetailsAction(1_000_001, false);
        mocks.getSeriesProgressAction.mockResolvedValue(dataSuccess({
            episodes: { "01.mp4": { positionSeconds: 1140, durationSeconds: 1200, completed: false } },
            resume: null,
        }));

        expect(await getSeriesDetailsAction(1_000_001, false)).toMatchObject({ data: {
            resumeEpisodeKey: null,
            episodes: [{ positionSeconds: 1140, percent: 95, watched: false }],
        } });
        expect(mocks.getSeriesProgressAction).toHaveBeenCalledTimes(2);
    });

    it("does not request enrichment when the catalog already contains a synopsis and metadata", async () => {
        mocks.resolveCatalogSeries.mockResolvedValue(dataSuccess(catalogSeriesFixture("series", { synopsis: "Saved synopsis" })));

        expect(await getSeriesDetailsAction(1_000_001, false)).toMatchObject({ data: {
            synopsis: "Saved synopsis", metadataPending: false, hasSynopsis: true,
        } });
        expect(mocks.resolveSeriesIdentity).not.toHaveBeenCalled();
    });

    it("keeps enriched metadata and signed playback URLs for existing default callers while deferring persistence", async () => {
        const result = await getSeriesDetailsAction(1_000_001);

        expect(result).toMatchObject({ kind: "success", data: {
            synopsis: "Provider synopsis", bannerImage: "/provider-banner.jpg", year: 2024, rating: "8.5",
            metadataPending: false, hasSynopsis: true,
            episodes: [{ url: "/signed-playback", positionSeconds: 600 }],
        } });
        expect(mocks.resolveCatalogSeries).toHaveBeenCalledWith("1000001", true);
        expect(mocks.resolveSeriesIdentity).toHaveBeenCalledWith("series");
        expect(mocks.after).toHaveBeenCalledTimes(1);
        expect(mocks.persistSeriesIdentity).not.toHaveBeenCalled();
        expect(mocks.invalidateCatalogCache).not.toHaveBeenCalled();

        let finishPersistence!: (saved: boolean) => void;
        mocks.persistSeriesIdentity.mockReturnValue(new Promise<boolean>((resolve) => { finishPersistence = resolve; }));
        const deferredWork = mocks.after.mock.calls[0][0]() as Promise<void>;
        expect(mocks.persistSeriesIdentity).toHaveBeenCalledWith("series", "jikan", "20", providerSeries, artwork, "auto");
        expect(mocks.invalidateCatalogCache).not.toHaveBeenCalled();
        finishPersistence(true);
        await deferredWork;
        expect(mocks.invalidateCatalogCache).toHaveBeenCalledTimes(1);
    });

    it("keeps successful metadata response when the deferred write fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.persistSeriesIdentity.mockRejectedValue(new Error("database unavailable"));
        const result = await getSeriesDetailsAction(1_000_001);

        await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
        expect(result).toMatchObject({ kind: "success", data: { synopsis: "Provider synopsis" } });
        expect(mocks.invalidateCatalogCache).not.toHaveBeenCalled();
    });

    it("avoids catalog invalidation when persistence reports an unsuccessful write", async () => {
        mocks.persistSeriesIdentity.mockResolvedValue(false);
        await getSeriesDetailsAction(1_000_001);

        await mocks.after.mock.calls[0][0]();

        expect(mocks.invalidateCatalogCache).not.toHaveBeenCalled();
    });

    it("does not attempt local metadata matching for virtual TMDB titles", async () => {
        mocks.resolveCatalogSeries.mockResolvedValue(dataSuccess(catalogSeriesFixture("tmdb:1399", { hasMetadata: false })));

        expect(await getSeriesDetailsAction(1_000_001)).toMatchObject({ data: { metadataPending: false } });
        expect(mocks.resolveSeriesIdentity).not.toHaveBeenCalled();
        expect(mocks.after).not.toHaveBeenCalled();
    });

    it("propagates progress errors rather than substituting an unwatched state", async () => {
        mocks.getSeriesProgressAction.mockResolvedValue(dataFailure("forbidden", 403));

        expect(await getSeriesDetailsAction(1_000_001, false)).toEqual(dataFailure("forbidden", 403));
        expect(mocks.resolveSeriesIdentity).not.toHaveBeenCalled();
        expect(mocks.fetchJikanRaw).not.toHaveBeenCalled();
    });

    it("keeps base loading available independently of a failed metadata provider", async () => {
        mocks.resolveSeriesIdentity.mockResolvedValue(dataFailure("network"));

        expect(await getSeriesDetailsAction(1_000_001, true)).toEqual(dataFailure("network"));
        expect(await getSeriesDetailsAction(1_000_001, false)).toMatchObject({ kind: "success", data: { episodes: [{ key: "01.mp4" }] } });
        expect(mocks.after).not.toHaveBeenCalled();
    });

    it("retains remote title and episode lookup when no catalog title exists", async () => {
        mocks.resolveCatalogSeries.mockResolvedValue(dataEmpty(null));
        mocks.fetchJikanRaw
            .mockResolvedValueOnce(dataSuccess({ data: {
                mal_id: 20, title: "Remote title", title_english: "Remote English title", synopsis: "Remote synopsis",
                images: { jpg: { image_url: "/poster.jpg" }, webp: { large_image_url: "/poster.webp" } },
                trailer: null, rating: null, year: 2002, score: 8, type: "TV", genres: [], studios: [],
            } }))
            .mockResolvedValueOnce(dataSuccess({ data: [{ mal_id: 1, title: "First episode", url: "https://example.com/episode/1" }], pagination: { has_next_page: true } }))
            .mockResolvedValueOnce(dataSuccess({ data: [{ mal_id: 2, title: "Second episode", url: "https://example.com/episode/2" }], pagination: { has_next_page: false } }));

        expect(await getSeriesDetailsAction(20, false)).toMatchObject({ kind: "success", data: {
            title: "Remote English title", seriesKey: null, isLocal: false,
            episodes: [{ key: "1", number: 1, title: "First episode", url: null }, { key: "2", number: 2, title: "Second episode", url: null }],
        } });
        expect(mocks.fetchJikanRaw.mock.calls.map(([path]) => path)).toEqual(["/anime/20", "/anime/20/episodes?page=1", "/anime/20/episodes?page=2"]);
        expect(mocks.getSeriesProgressAction).not.toHaveBeenCalled();
        expect(mocks.resolveSeriesIdentity).not.toHaveBeenCalled();
    });
});
