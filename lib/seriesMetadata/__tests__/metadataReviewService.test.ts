import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMetadataReviewSnapshot = vi.fn();
vi.mock("../seriesMetadataRepository", () => ({ loadMetadataReviewSnapshot }));

const { listMetadataReview } = await import("../metadataReviewService");

beforeEach(() => vi.clearAllMocks());

describe("listMetadataReview", () => {
    it("wylicza brak mapowania i brak plakatu z danych TS", async () => {
        loadMetadataReviewSnapshot.mockResolvedValue([
            { seriesKey: "A", groupId: null, seasonNumber: null, reviewState: null, reviewReason: null,
                externalIds: {}, externalIdSources: {}, artwork: [] },
            { seriesKey: "B", groupId: null, seasonNumber: null, reviewState: null, reviewReason: null,
                externalIds: { tmdb: "tv:2" }, externalIdSources: { tmdb: "auto" }, artwork: [] },
        ]);

        const result = await listMetadataReview(new Map([["A", "Tytuł A"]]));

        expect(result[0]).toMatchObject({ title: "Tytuł A", state: "pending", reason: "no-match" });
        expect(result[1]).toMatchObject({ state: "pending", reason: "missing-poster" });
    });

    it("zachowuje świadomie pominięty rekord", async () => {
        loadMetadataReviewSnapshot.mockResolvedValue([{
            seriesKey: "A", groupId: null, seasonNumber: null, reviewState: "skipped", reviewReason: "no-match",
            externalIds: {}, externalIdSources: {}, artwork: [],
        }]);
        await expect(listMetadataReview()).resolves.toMatchObject([{ state: "skipped", reason: "no-match" }]);
    });
});
