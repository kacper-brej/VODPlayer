import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.VIDEO_SIGNING_SECRET = process.env.VIDEO_SIGNING_SECRET ?? "benchmark-secret";

const findReadyHlsAsset = vi.fn();
vi.mock("@/lib/player/hlsRepository", () => ({ findReadyHlsAsset }));

const fetchObjectText = vi.fn();
const presignedObjectUrl = vi.fn();
class MockB2ConfigError extends Error {}
vi.mock("@/lib/player/b2Storage", () => ({
    fetchObjectText,
    presignedObjectUrl,
    B2ConfigError: MockB2ConfigError,
}));

const { buildManifest, clearMediaPlaylistCache } = await import("../hlsService");

const SEGMENTS = 250;
const template = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    '#EXT-X-MAP:URI="init.mp4"',
    ...Array.from({ length: SEGMENTS }, (_, index) => `#EXTINF:6.0,\n${String(index).padStart(4, "0")}.m4s`),
    "#EXT-X-ENDLIST",
    "",
].join("\n");

describe("kontrolowany benchmark manifestu typowego odcinka", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearMediaPlaylistCache();
        findReadyHlsAsset.mockResolvedValue({
            id: 42,
            version: 7,
            durationSeconds: 1500,
            renditions: [{
                height: 720,
                width: 1280,
                bitrateKbps: 2500,
                playlistKey: "media/Test/01/720/index.m3u8",
            }],
        });
        fetchObjectText.mockResolvedValue(template);
        presignedObjectUrl.mockImplementation(async (key: string) =>
            `https://f000.backblazeb2.com/file/nocturna/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=redacted&X-Amz-Expires=2100&X-Amz-Signature=${"a".repeat(64)}`
        );
    });

    it("mierzy cold i warm bez zapisu do produkcji", async () => {
        const startCold = performance.now();
        const cold = await buildManifest(42, 7, "Test", "01.mp4", "720", 1999999999, "/api/hls");
        const coldMs = performance.now() - startCold;

        const startWarm = performance.now();
        const warm = await buildManifest(42, 7, "Test", "01.mp4", "720", 1999999999, "/api/hls");
        const warmMs = performance.now() - startWarm;

        expect(cold.ok).toBe(true);
        expect(warm.ok).toBe(true);
        expect(findReadyHlsAsset).toHaveBeenCalledTimes(2);
        expect(fetchObjectText).toHaveBeenCalledTimes(1);
        expect(presignedObjectUrl).toHaveBeenCalledTimes((SEGMENTS + 1) * 2);

        const body = cold.ok ? cold.body : "";
        console.info("HLS_BENCHMARK", JSON.stringify({
            segments: SEGMENTS,
            coldMs: Number(coldMs.toFixed(3)),
            warmMs: Number(warmMs.toFixed(3)),
            mysqlQueriesPerRequest: 1,
            coldB2Gets: 1,
            warmB2Gets: 0,
            presignsPerRequest: SEGMENTS + 1,
            bodyBytes: Buffer.byteLength(body),
            manifestTtlSeconds: 90,
            segmentTtlSeconds: 2100,
        }));
    });
});
