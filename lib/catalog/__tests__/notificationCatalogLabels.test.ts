import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";
import { getNotificationCatalogLabels } from "@/lib/catalog/notificationCatalogLabels";

const mocks = vi.hoisted(() => ({ loadCatalogPayload: vi.fn() }));

vi.mock("@/lib/catalog/catalog", () => ({ loadCatalogPayload: mocks.loadCatalogPayload }));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadCatalogPayload.mockResolvedValue({ generatedAt: 1, series: [] });
});

describe("notification catalog labels", () => {
    it("skips catalog loading for an empty notification list", async () => {
        const result = await getNotificationCatalogLabels([]);

        expect(result).toEqual({ kind: "empty", data: new Map() });
        expect(mocks.loadCatalogPayload).not.toHaveBeenCalled();
    });

    it("selects only requested labels without reading unrelated episodes or playback data", async () => {
        const selected = catalogSeriesFixture("selected", { baseTitle: "Shared title" });
        const requestedEpisode = selected.episodes[0];
        const unusedEpisode = { ...requestedEpisode, key: "unused.mp4" };
        Object.defineProperty(requestedEpisode, "media", {
            get: () => { throw new Error("Playback metadata should not be read"); },
        });
        Object.freeze(requestedEpisode);
        Object.defineProperty(unusedEpisode, "key", {
            get: () => { throw new Error("All requested episodes were already found"); },
        });
        selected.episodes = [requestedEpisode, unusedEpisode];
        const unrelated = catalogSeriesFixture("unrelated");
        Object.defineProperty(unrelated, "episodes", {
            get: () => { throw new Error("Unrelated episodes should not be read"); },
        });
        Object.freeze(selected.episodes);
        Object.freeze(selected);
        mocks.loadCatalogPayload.mockResolvedValue({ generatedAt: 1, series: [unrelated, selected] });

        const result = await getNotificationCatalogLabels([
            { seriesKey: "selected", episodeKey: "01.mp4" },
            { seriesKey: "selected", episodeKey: "01.mp4" },
        ]);

        expect(result).toEqual({
            kind: "success",
            data: new Map([["selected", {
                title: "Shared title",
                episodeNumbers: new Map([["01.mp4", 1]]),
            }]]),
        });
        expect(mocks.loadCatalogPayload).toHaveBeenCalledOnce();
    });

    it("preserves title fallback and matches identical episode keys within their own series", async () => {
        const first = catalogSeriesFixture("first", { title: "First title", baseTitle: null, visibility: "restricted" });
        const second = catalogSeriesFixture("second", { baseTitle: "", title: "Second title" });
        second.episodes[0].number = 12;
        mocks.loadCatalogPayload.mockResolvedValue({ generatedAt: 1, series: [first, second] });

        const result = await getNotificationCatalogLabels([
            { seriesKey: "first", episodeKey: "01.mp4" },
            { seriesKey: "first", episodeKey: "missing.mp4" },
            { seriesKey: "second", episodeKey: "01.mp4" },
            { seriesKey: "unpublished", episodeKey: "01.mp4" },
        ]);

        expect(result).toEqual({
            kind: "success",
            data: new Map([
                ["first", { title: "First title", episodeNumbers: new Map([["01.mp4", 1]]) }],
                ["second", { title: "", episodeNumbers: new Map([["01.mp4", 12]]) }],
            ]),
        });
    });

    it("does not resolve titles absent from the published catalog", async () => {
        mocks.loadCatalogPayload.mockResolvedValue({ generatedAt: 1, series: [catalogSeriesFixture("published")] });

        const result = await getNotificationCatalogLabels([
            { seriesKey: "_system", episodeKey: "01.mp4" },
            { seriesKey: "unpublished", episodeKey: "01.mp4" },
        ]);

        expect(result).toEqual({ kind: "empty", data: new Map() });
    });

    it("returns a recoverable failure when the cached catalog cannot be loaded", async () => {
        const error = new Error("Catalog unavailable");
        mocks.loadCatalogPayload.mockRejectedValue(error);
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            const result = await getNotificationCatalogLabels([{ seriesKey: "series", episodeKey: "01.mp4" }]);

            expect(result).toEqual({ kind: "error", reason: "server" });
            expect(logged).toHaveBeenCalledWith("Notification catalog labels request failed:", error);
        } finally {
            logged.mockRestore();
        }
    });
});
