import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchObjectText = vi.fn();
const presignedObjectUrl = vi.fn();
class MockB2ConfigError extends Error {}
vi.mock("@/lib/player/b2Storage", () => ({ fetchObjectText, presignedObjectUrl, B2ConfigError: MockB2ConfigError }));

const {
    buildShortPreviewManifest,
    clearPreviewPlaylistCache,
    parsePreviewPlaylistIndex,
    preparePreviewRange,
    selectPreviewRendition,
} = await import("../previewHlsService");

const playlist = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-MAP:URI="init.mp4"
#EXTINF:6.000,
000.m4s
#EXTINF:6.000,
001.m4s
#EXTINF:6.000,
002.m4s
#EXTINF:6.000,
003.m4s
#EXT-X-ENDLIST
`;
const asset = {
    id: 42, version: 7, seriesKey: "Test", episodeKey: "01.mp4", durationSeconds: 24,
    previewStartSeconds: 6, previewClipKey: null, progress: null,
    renditions: [
        { height: 480, playlistKey: "media/Test/01/480/index.m3u8" },
        { height: 720, playlistKey: "media/Test/01/720/index.m3u8" },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
    clearPreviewPlaylistCache();
    fetchObjectText.mockResolvedValue(playlist);
    presignedObjectUrl.mockImplementation(async (key: string) => `signed:${key}`);
});

describe("krotki HLS preview", () => {
    it("parsuje indeks bez pobierania mediow", () => {
        expect(parsePreviewPlaylistIndex(playlist)?.segments).toHaveLength(4);
        expect(parsePreviewPlaylistIndex(playlist)?.segments[2]).toMatchObject({ uri: "002.m4s", timelineStartSeconds: 12 });
    });

    it("wybiera 720 domyslnie i najnizszy wariant dla reduceData", () => {
        expect(selectPreviewRendition(asset.renditions, false)?.height).toBe(720);
        expect(selectPreviewRendition(asset.renditions, true)?.height).toBe(480);
    });

    it("wylicza zakres i offset pierwszego segmentu", async () => {
        await expect(preparePreviewRange(asset, 7, 10, true)).resolves.toEqual({
            variant: 480,
            firstSegment: 1,
            lastSegment: 2,
            mediaOffsetSeconds: 1,
        });
    });

    it("manifest zawiera init i tylko podpisany krotki zakres", async () => {
        const result = await buildShortPreviewManifest(asset, 480, 1, 2);
        expect(result.ok).toBe(true);
        const body = result.ok ? result.body : "";
        expect(body).toContain("signed:media/Test/01/480/init.mp4");
        expect(body).toContain("signed:media/Test/01/480/001.m4s");
        expect(body).toContain("signed:media/Test/01/480/002.m4s");
        expect(body).not.toContain("000.m4s");
        expect(body).not.toContain("003.m4s");
        expect(body).not.toContain("#EXT-X-STREAM-INF");
    });

    it("mierzy rozmiar krótkiego manifestu względem pełnego manifestu odcinka", async () => {
        presignedObjectUrl.mockImplementation(async (key: string) =>
            `https://f000.backblazeb2.com/file/nocturna/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=redacted&X-Amz-Expires=180&X-Amz-Signature=${"a".repeat(64)}`
        );
        const result = await buildShortPreviewManifest(asset, 480, 1, 2);
        expect(result.ok).toBe(true);
        const body = result.ok ? result.body : "";
        console.info("PREVIEW_MANIFEST_BENCHMARK", JSON.stringify({
            segments: 2,
            signedMediaObjects: 3,
            bodyBytes: Buffer.byteLength(body),
            fullEpisodeManifestBaselineBytes: 60_786,
        }));
    });

    it("warm request korzysta z cache indeksu B2", async () => {
        await preparePreviewRange(asset, 7, 10, true);
        await preparePreviewRange(asset, 8, 10, true);
        expect(fetchObjectText).toHaveBeenCalledTimes(1);
    });

    it("odrzuca zbyt szeroki zakres mimo poprawnego typu", async () => {
        await expect(buildShortPreviewManifest(asset, 480, 0, 20)).resolves.toEqual({ ok: false, code: "invalid" });
    });
});
