import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    catalog: vi.fn(), demo: vi.fn(), resume: vi.fn(), progress: vi.fn(), chapters: vi.fn(),
    settings: vi.fn(), playback: vi.fn(), demoPlayback: vi.fn(),
}));
vi.mock("@/lib/catalog/catalog", () => ({ resolveCatalogSeries: mocks.catalog }));
vi.mock("@/lib/catalog/tmdbVirtualSeries", () => ({
    getVirtualTmdbEpisodes: vi.fn(), isVirtualTmdbTvKey: () => false, parseVirtualEpisodeKey: () => null,
}));
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset: mocks.demo }));
vi.mock("@/lib/progress/continueWatching", () => ({ getSeriesResume: mocks.resume }));
vi.mock("@/lib/progress/getProgressAction", () => ({ getSeriesProgressAction: mocks.progress }));
vi.mock("@/lib/chapters/chapters", () => ({ getEpisodeChapters: mocks.chapters }));
vi.mock("@/lib/settings/settings", () => ({
    getSettings: mocks.settings, DEFAULT_PROFILE_SETTINGS: { autoplayNext: true, skipIntroPrompt: true, defaultVolume: 80 },
}));
vi.mock("@/lib/player/videoAccess", () => ({ resolvePlaybackSource: mocks.playback, playbackSourceFromAsset: mocks.demoPlayback }));
import { resolveWatchData } from "../resolveWatchData";

const series = () => ({
    id: 1, key: "series", title: "Serial", seasonNumber: 1, synopsis: "Opis", access: "full", episodeCount: 3,
    episodes: [1, 2, 3].map((number) => ({ number, key: `${number}.mp4`, title: `Odcinek ${number}` })),
});

describe("shared watch data", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.catalog.mockResolvedValue({ kind: "success", data: series() });
        mocks.demo.mockResolvedValue(null);
        mocks.progress.mockResolvedValue({ kind: "success", data: { episodes: { "2.mp4": { positionSeconds: 32 } } } });
        mocks.chapters.mockResolvedValue({ kind: "success", data: [{ type: "intro", startSeconds: 0, endSeconds: 20 }] });
        mocks.settings.mockResolvedValue({ kind: "success", data: { autoplayNext: false, skipIntroPrompt: true, defaultVolume: 65 } });
        mocks.playback.mockReturnValue({ kind: "file", src: "/signed/episode", expiresAt: 100 });
    });

    it.each(["2", "2.mp4"])("loads episode %s with its own progress, chapters and neighbours", async (episode) => {
        const result = await resolveWatchData("1", episode);
        expect(result).toMatchObject({ kind: "success", data: {
            fileName: "2.mp4", currentEpisode: 2, startTime: 27, previousEpisodeKey: "1.mp4",
            nextEpisodeKey: "3.mp4", autoplayNext: false, defaultVolume: 65,
            chapters: [{ type: "intro", endSeconds: 20 }],
        } });
        expect(mocks.chapters).toHaveBeenCalledWith("series", "2.mp4");
        expect(mocks.playback).toHaveBeenCalledWith("series", series().episodes[1]);
    });

    it("does not sign a source when access is denied", async () => {
        mocks.catalog.mockResolvedValue({ kind: "success", data: { ...series(), access: "none" } });
        expect(await resolveWatchData("1", "2")).toMatchObject({ kind: "error", status: 403 });
        expect(mocks.playback).not.toHaveBeenCalled();
    });

    it("uses only the demo source for a viewer without full access", async () => {
        mocks.catalog.mockResolvedValue({ kind: "success", data: { ...series(), access: "none" } });
        mocks.demo.mockResolvedValue({ assetId: 10, assetVersion: 1, seriesKey: "demo", episodeKey: "1.mp4", heights: [720], durationSeconds: 60 });
        mocks.demoPlayback.mockReturnValue({ kind: "hls", src: "/demo" });
        expect(await resolveWatchData("1", "2")).toMatchObject({ kind: "success", data: { isDemo: true, playback: { src: "/demo" } } });
        expect(mocks.playback).not.toHaveBeenCalled();
        expect(mocks.demoPlayback).toHaveBeenCalledWith(10, 1, "demo", "1.mp4", [720]);
    });

    it("keeps resume behaviour when an initial URL has no episode", async () => {
        mocks.progress.mockResolvedValue({ kind: "success", data: { episodes: {}, resume: { episodeKey: "3.mp4", positionSeconds: 45 } } });
        expect(await resolveWatchData("1")).toMatchObject({ kind: "success", data: { fileName: "3.mp4", startTime: 40 } });
        expect(mocks.progress).toHaveBeenCalledExactlyOnceWith("series");
        expect(mocks.resume).not.toHaveBeenCalled();
    });

    it("reuses scoped progress when the resumed episode is unavailable", async () => {
        mocks.progress.mockResolvedValue({ kind: "success", data: {
            episodes: { "1.mp4": { positionSeconds: 22 } },
            resume: { episodeKey: "removed.mp4", positionSeconds: 45 },
        } });
        expect(await resolveWatchData("1")).toMatchObject({ kind: "success", data: { fileName: "1.mp4", startTime: 17 } });
        expect(mocks.progress).toHaveBeenCalledExactlyOnceWith("series");
        expect(mocks.resume).not.toHaveBeenCalled();
    });

    it("starts settings before catalog resolution finishes", async () => {
        let finishCatalog!: (value: unknown) => void;
        mocks.catalog.mockReturnValue(new Promise((resolve) => { finishCatalog = resolve; }));
        const pending = resolveWatchData("1", "2");
        expect(mocks.settings).toHaveBeenCalledOnce();
        expect(mocks.progress).not.toHaveBeenCalled();
        finishCatalog({ kind: "success", data: series() });
        expect(await pending).toMatchObject({ kind: "success", data: { defaultVolume: 65 } });
    });

    it("keeps default settings when the early read fails", async () => {
        mocks.settings.mockRejectedValueOnce(new Error("unavailable"));
        expect(await resolveWatchData("1", "2")).toMatchObject({ kind: "success", data: { defaultVolume: 80, autoplayNext: true } });
    });

    it("preserves progress access errors without resolving a playback URL", async () => {
        mocks.progress.mockResolvedValue({ kind: "error", reason: "unauthorized" });
        expect(await resolveWatchData("1")).toEqual({ kind: "data-error", reason: "unauthorized" });
        expect(mocks.playback).not.toHaveBeenCalled();
    });

    it("rejects missing episodes without signing a source", async () => {
        expect(await resolveWatchData("1", "99")).toMatchObject({ kind: "error", status: 404 });
        expect(mocks.playback).not.toHaveBeenCalled();
    });
});
