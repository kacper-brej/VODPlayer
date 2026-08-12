import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag }));

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

vi.mock("@/lib/core/vodConfig", () => ({
    CATALOG_TAG: "catalog",
}));

const getSeriesMetadata = vi.fn();
const saveReviewDecision = vi.fn();
vi.mock("@/lib/seriesMetadata/seriesMetadataService", () => ({
    getSeriesMetadata,
    saveReviewDecision,
}));

const getTmdbSeasonEpisodes = vi.fn();
const getTmdbSeasonSummaries = vi.fn();
vi.mock("@/lib/metadata/providers/tmdb", () => ({
    getTmdbSeasonEpisodes,
    getTmdbSeasonSummaries,
}));

const listEpisodeBackfillSeries = vi.fn();
const saveEpisodeMetadata = vi.fn();
vi.mock("@/lib/episodes/episodeMetadataService", () => ({
    listEpisodeBackfillSeries,
    saveEpisodeMetadata,
}));

const { refreshSeriesEpisodeStillsAction } = await import("../episodeStillsBackfillAction");

beforeEach(() => vi.clearAllMocks());

describe("refreshSeriesEpisodeStillsAction", () => {
    it("odrzuca widza przed odczytem i zapisem metadanych", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Widz", email: "w@example.com", role: "viewer" });

        await expect(refreshSeriesEpisodeStillsAction("Test")).resolves.toMatchObject({
            kind: "error",
            reason: "forbidden",
        });
        expect(listEpisodeBackfillSeries).not.toHaveBeenCalled();
        expect(saveEpisodeMetadata).not.toHaveBeenCalled();
    });

    it("zapisuje wynik TMDB bezpośrednio przez serwis TS i zachowuje lokalną miniaturę", async () => {
        getSessionUser.mockResolvedValue({ id: 2, username: "Admin", email: "a@example.com", role: "admin" });
        listEpisodeBackfillSeries.mockResolvedValue([{
            key: "Test",
            title: "Test",
            seasonNumber: 1,
            episodes: [{
                key: "01.mp4",
                number: 1,
                title: null,
                synopsis: null,
                thumbnailPath: "/local.jpg",
                thumbnailSource: "local",
            }],
        }]);
        getSeriesMetadata.mockResolvedValue({ seriesKey: "Test", externalIds: { tmdb: "tv:10" }, titles: [] });
        getTmdbSeasonEpisodes.mockResolvedValue({
            kind: "success",
            data: [{ number: 1, title: "Pierwszy", synopsis: "Opis", stillPath: "/tmdb.jpg" }],
        });
        saveEpisodeMetadata.mockResolvedValue({ ok: true, data: {} });

        await expect(refreshSeriesEpisodeStillsAction("Test")).resolves.toMatchObject({
            kind: "success",
            data: { status: "updated", matchedEpisodes: 1 },
        });
        expect(saveEpisodeMetadata).toHaveBeenCalledWith({
            series: "Test",
            episode: "01.mp4",
            title: "Pierwszy",
            synopsis: "Opis",
        });
        expect(updateTag).toHaveBeenCalledWith("catalog");
        expect(getSeriesMetadata).toHaveBeenCalledWith("Test");
    });
});
