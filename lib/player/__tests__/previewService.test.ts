import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.VIDEO_SIGNING_SECRET = "preview-test-secret-at-least-32-characters-long";

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));
const findPreviewSessionAsset = vi.fn();
const findGrantedPreviewAsset = vi.fn();
vi.mock("@/lib/player/previewRepository", () => ({ findPreviewSessionAsset, findGrantedPreviewAsset }));
const preparePreviewRange = vi.fn();
vi.mock("@/lib/player/previewHlsService", () => ({ preparePreviewRange }));
const presignedObjectUrl = vi.fn();
class MockB2ConfigError extends Error {}
vi.mock("@/lib/player/b2Storage", () => ({ presignedObjectUrl, B2ConfigError: MockB2ConfigError }));

const getViewerSeriesAccessLevel = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ getViewerSeriesAccessLevel }));
const getDemoAsset = vi.fn();
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset }));

const { buildGrantedPreviewClip, createPreviewSession } = await import("../previewService");

const asset = {
    id: 42,
    version: 7,
    seriesKey: "Test",
    episodeKey: "01.mp4",
        delivery: "hls" as const,
    durationSeconds: 1200,
    previewStartSeconds: 30,
    previewClipKey: "media/Test/01.mp4/preview.mp4",
    renditions: [{ height: 480, playlistKey: "media/Test/01.mp4/480/index.m3u8" }],
    progress: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    resolveOwnedProfileId.mockResolvedValue(11);
    getViewerSeriesAccessLevel.mockResolvedValue("full");
    getDemoAsset.mockResolvedValue(null);
});

describe("createPreviewSession", () => {
    it("nowy odcinek zwraca wyciety MP4 z lokalnym offsetem zero", async () => {
        findPreviewSessionAsset.mockResolvedValue(asset);
        const result = await createPreviewSession(1, "user", "Test", "01.mp4", false);
        expect(result).toMatchObject({
            ok: true,
            source: {
                type: "mp4",
                mediaOffsetSeconds: 0,
                sourceTimelineStartSeconds: 30,
                reason: "editorial",
            },
        });
        if (result.ok) {
            expect(result.source.src).toContain("/api/preview/clip?");
            expect(new URLSearchParams(result.source.src.split("?")[1]).get("p")).toBe("11");
        }
        expect(preparePreviewRange).not.toHaveBeenCalled();
        expect(findPreviewSessionAsset).toHaveBeenCalledWith(11, "Test", "01.mp4", { seriesKey: "Test", episodeKey: "01.mp4" });
    });

    it("bez pełnego dostępu czyta asset demonstracyjny, a postęp po prawdziwym tytule", async () => {
        getViewerSeriesAccessLevel.mockResolvedValue("demo");
        getDemoAsset.mockResolvedValue({
            assetId: 99, assetVersion: 1, seriesKey: "_demo", episodeKey: "demo.mp4",
            durationSeconds: 600, heights: [480],
        });
        findPreviewSessionAsset.mockResolvedValue({
            ...asset, id: 99, version: 1, seriesKey: "_demo", episodeKey: "demo.mp4", durationSeconds: 600,
            previewClipKey: "media/_demo/demo.mp4/preview.mp4",
        });

        const result = await createPreviewSession(1, "user", "Tokyo Ghoul", "01.mp4", false);

        expect(findPreviewSessionAsset).toHaveBeenCalledWith(
            11, "_demo", "demo.mp4", { seriesKey: "Tokyo Ghoul", episodeKey: "01.mp4" },
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            const query = new URLSearchParams(result.source.src.split("?")[1]);
            expect(query.get("s")).toBe("_demo");
            expect(query.get("e")).toBe("demo.mp4");
            expect(query.get("a")).toBe("99");
        }
    });

    it("bez pełnego dostępu i bez skonfigurowanego demo nie wydaje podglądu", async () => {
        getViewerSeriesAccessLevel.mockResolvedValue("demo");
        getDemoAsset.mockResolvedValue(null);

        await expect(createPreviewSession(1, "user", "Tokyo Ghoul", "01.mp4", false))
            .resolves.toEqual({ ok: false, code: "not_found" });
        expect(findPreviewSessionAsset).not.toHaveBeenCalled();
    });

    it("ogladany odcinek zwraca tylko krotki zakres HLS, nigdy master", async () => {
        findPreviewSessionAsset.mockResolvedValue({
            ...asset,
            progress: { assetVersion: 7, positionSeconds: 100, durationSeconds: 1200, completed: false },
        });
        preparePreviewRange.mockResolvedValue({ variant: 480, firstSegment: 15, lastSegment: 17, mediaOffsetSeconds: 0 });
        const result = await createPreviewSession(1, "user", "Test", "01.mp4", true);
        expect(result).toMatchObject({ ok: true, source: { type: "hls", sourceTimelineStartSeconds: 90, reason: "resume" } });
        if (result.ok) {
            expect(result.source.src).toContain("/api/preview/hls?");
            expect(result.source.src).not.toContain("/api/hls?");
            const query = new URLSearchParams(result.source.src.split("?")[1]);
            expect(query.get("from")).toBe("15");
            expect(query.get("to")).toBe("17");
        }
        expect(preparePreviewRange).toHaveBeenCalledWith(expect.any(Object), 90, 10, true);
    });

    it("completed wraca do wycietego MP4 zamiast koncowki HLS", async () => {
        findPreviewSessionAsset.mockResolvedValue({
            ...asset,
            progress: { assetVersion: 7, positionSeconds: 1150, durationSeconds: 1200, completed: true },
        });
        await expect(createPreviewSession(1, "user", "Test", "01.mp4", false)).resolves.toMatchObject({
            ok: true,
            source: { type: "mp4", mediaOffsetSeconds: 0, reason: "completed-fallback" },
        });
    });

    it("bez gotowego klipu uzywa krotkiego HLS takze dla fallbacku", async () => {
        findPreviewSessionAsset.mockResolvedValue({ ...asset, previewClipKey: null });
        preparePreviewRange.mockResolvedValue({ variant: 480, firstSegment: 5, lastSegment: 7, mediaOffsetSeconds: 0 });
        await expect(createPreviewSession(1, "user", "Test", "01.mp4", true)).resolves.toMatchObject({
            ok: true,
            source: { type: "hls", reason: "editorial" },
        });
    });
});

describe("buildGrantedPreviewClip", () => {
    it("podpisuje tylko klip aktualnej wersji na 120 sekund", async () => {
        findGrantedPreviewAsset.mockResolvedValue(asset);
        presignedObjectUrl.mockResolvedValue("https://b2.example/signed");
        await expect(buildGrantedPreviewClip({
            kind: "clip", profileId: 11, assetId: 42, assetVersion: 7,
            seriesKey: "Test", episodeKey: "01.mp4", variant: 0,
            firstSegment: -1, lastSegment: -1, expiresAt: 1999999999,
        })).resolves.toEqual({ ok: true, url: "https://b2.example/signed" });
        expect(presignedObjectUrl).toHaveBeenCalledWith("media/Test/01.mp4/preview.mp4", 120);
    });
});
