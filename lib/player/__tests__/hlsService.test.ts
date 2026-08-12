import { describe, expect, it, vi, beforeEach } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

process.env.VIDEO_SIGNING_SECRET = process.env.VIDEO_SIGNING_SECRET ?? "test-video-secret-do-not-use-in-prod";

const findReadyHlsAsset = vi.fn();
vi.mock("@/lib/player/hlsRepository", () => ({ findReadyHlsAsset }));

const presignedObjectUrl = vi.fn();
const fetchObjectText = vi.fn();
class MockB2ConfigError extends Error {}
vi.mock("@/lib/player/b2Storage", () => ({
    presignedObjectUrl,
    fetchObjectText,
    B2ConfigError: MockB2ConfigError,
}));

const { buildMasterPlaylist, rewriteMediaPlaylist, buildManifest, clearMediaPlaylistCache, segmentPresignTtlSeconds } = await import("../hlsService");
const readyAsset = (renditions: Array<{ height: number; width: number | null; bitrateKbps: number; playlistKey: string }>) => ({
    id: 42, version: 7, durationSeconds: 1800, renditions,
});

beforeEach(() => {
    vi.clearAllMocks();
    clearMediaPlaylistCache();
});

describe("buildMasterPlaylist", () => {
    it("naglowek EXTM3U i wersja HLS", () => {
        const body = buildMasterPlaylist(42, 7, "Frieren", "01.mp4", [], 1999999999, "/api/hls");
        expect(body.startsWith("#EXTM3U\n#EXT-X-VERSION:7\n")).toBe(true);
    });

    it("renditiony posortowane po bitrate rosnaco, niezaleznie od kolejnosci wejsciowej", () => {
        const renditions = [
            { height: 1080, width: 1920, bitrateKbps: 5000, playlistKey: "x" },
            { height: 480, width: 854, bitrateKbps: 1200, playlistKey: "x" },
        ];
        const body = buildMasterPlaylist(42, 7, "Frieren", "01.mp4", renditions, 1999999999, "/api/hls");
        const bandwidths = [...body.matchAll(/BANDWIDTH=(\d+)/g)].map((m) => Number(m[1]));
        expect(bandwidths).toEqual([1200000, 5000000]);
    });

    it("RESOLUTION dolaczane tylko gdy width > 0", () => {
        const withWidth = buildMasterPlaylist(
            42, 7, "Frieren", "01.mp4", [{ height: 720, width: 1280, bitrateKbps: 2500, playlistKey: "x" }], 1999999999, "/api/hls",
        );
        expect(withWidth).toContain("RESOLUTION=1280x720");

        const withoutWidth = buildMasterPlaylist(
            42, 7, "Frieren", "01.mp4", [{ height: 720, width: null, bitrateKbps: 2500, playlistKey: "x" }], 1999999999, "/api/hls",
        );
        expect(withoutWidth).not.toContain("RESOLUTION");
    });

    it("URL wariantu zawiera podpisany query string wskazujacy na manifestPath", () => {
        const body = buildMasterPlaylist(
            42, 7, "Frieren", "01.mp4", [{ height: 720, width: 1280, bitrateKbps: 2500, playlistKey: "x" }], 1999999999, "/api/hls",
        );
        const urlLine = body.split("\n").find((line) => line.startsWith("/api/hls?"));
        expect(urlLine).toBeDefined();
        const params = new URLSearchParams(urlLine!.split("?")[1]);
        expect(params.get("s")).toBe("Frieren");
        expect(params.get("a")).toBe("42");
        expect(params.get("ver")).toBe("7");
        expect(params.get("e")).toBe("01.mp4");
        expect(params.get("v")).toBe("720");
        expect(params.get("exp")).toBe("1999999999");
        expect(params.get("sig")).toHaveLength(64);
    });
});

describe("rewriteMediaPlaylist", () => {
    it("ogranicza TTL segmentow do czasu odcinka z marginesem", () => {
        expect(segmentPresignTtlSeconds(1500)).toBe(2100);
        expect(segmentPresignTtlSeconds(10)).toBe(900);
        expect(segmentPresignTtlSeconds(10000)).toBe(7200);
    });
    it("brak oryginalnej playlisty w B2 -> null", async () => {
        fetchObjectText.mockResolvedValue(null);
        await expect(rewriteMediaPlaylist("media/Frieren/01.mp4/720p/index.m3u8", "42:7:720", 1800)).resolves.toBeNull();
    });

    it("linia EXT-X-MAP z init.mp4 zastapiona podpisanym URL-em do B2", async () => {
        fetchObjectText.mockResolvedValue('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\n000.m4s\n');
        presignedObjectUrl.mockImplementation(async (key: string) => `https://b2.example/${encodeURIComponent(key)}?presigned`);

        const result = await rewriteMediaPlaylist("media/Frieren/01.mp4/720p/index.m3u8", "42:7:720", 1800);

        expect(presignedObjectUrl).toHaveBeenCalledWith("media/Frieren/01.mp4/720p/init.mp4", 2400);
        expect(result).toContain('#EXT-X-MAP:URI="https://b2.example/');
        expect(result).not.toContain('URI="init.mp4"');
    });

    it("linie komentarzy (#) zachowane bez zmian poza EXT-X-MAP", async () => {
        fetchObjectText.mockResolvedValue("#EXTM3U\n#EXT-X-VERSION:7\n#EXTINF:6.0,\n000.m4s\n");
        presignedObjectUrl.mockResolvedValue("https://b2.example/signed");

        const result = await rewriteMediaPlaylist("media/Frieren/01.mp4/720p/index.m3u8", "42:7:720", 1800);

        expect(result).toContain("#EXTM3U");
        expect(result).toContain("#EXT-X-VERSION:7");
        expect(result).toContain("#EXTINF:6.0,");
    });

    it("linie segmentow (bez #) zastapione podpisanymi URL-ami do B2", async () => {
        fetchObjectText.mockResolvedValue("#EXTINF:6.0,\n000.m4s\n#EXTINF:6.0,\n001.m4s\n");
        presignedObjectUrl.mockImplementation(async (key: string) => `signed:${key}`);

        const result = await rewriteMediaPlaylist("media/Frieren/01.mp4/720p/index.m3u8", "42:7:720", 1800);

        expect(presignedObjectUrl).toHaveBeenCalledWith("media/Frieren/01.mp4/720p/000.m4s", 2400);
        expect(presignedObjectUrl).toHaveBeenCalledWith("media/Frieren/01.mp4/720p/001.m4s", 2400);
        expect(result).toContain("signed:media/Frieren/01.mp4/720p/000.m4s");
        expect(result).not.toContain("\n000.m4s\n");
    });

    it("puste linie zachowane (wliczajac koncowy pusty element po ostatnim \\n, tak jak PHP explode/implode)", async () => {
        fetchObjectText.mockResolvedValue("#EXTM3U\n\n#EXT-X-ENDLIST\n");
        const result = await rewriteMediaPlaylist("media/Frieren/01.mp4/720p/index.m3u8", "42:7:720", 1800);
        expect(result).toBe("#EXTM3U\n\n#EXT-X-ENDLIST\n");
    });

    it("ponownie wykorzystuje gotowa playliste zamiast drugi raz pobierac ja z B2", async () => {
        fetchObjectText.mockResolvedValue("#EXTINF:6.0,\n000.m4s\n");
        presignedObjectUrl.mockResolvedValue("https://b2.example/signed-segment");
        const key = "media/Cache/01.mp4/480p/index.m3u8";

        const first = await rewriteMediaPlaylist(key, "42:7:480", 1800);
        const second = await rewriteMediaPlaylist(key, "42:7:480", 1800);

        expect(second).toBe(first);
        expect(fetchObjectText).toHaveBeenCalledTimes(1);
        expect(presignedObjectUrl).toHaveBeenCalledTimes(2);
    });

    it("zmiana assetVersion uniewaznia cache szablonu", async () => {
        fetchObjectText.mockResolvedValue("#EXTINF:6.0,\n000.m4s\n");
        presignedObjectUrl.mockResolvedValue("signed");
        const key = "media/Cache/01.mp4/480p/index.m3u8";

        await rewriteMediaPlaylist(key, "42:7:480", 1800);
        await rewriteMediaPlaylist(key, "42:8:480", 1800);

        expect(fetchObjectText).toHaveBeenCalledTimes(2);
    });

    it("presignuje rownolegle, ale najwyzej 32 obiekty naraz", async () => {
        const segments = Array.from({ length: 70 }, (_, index) => `#EXTINF:6.0,\n${index}.m4s`).join("\n");
        fetchObjectText.mockResolvedValue(`${segments}\n`);
        let active = 0;
        let maximum = 0;
        presignedObjectUrl.mockImplementation(async (key: string) => {
            active += 1;
            maximum = Math.max(maximum, active);
            await new Promise((resolve) => setTimeout(resolve, 1));
            active -= 1;
            return `signed:${key}`;
        });

        await rewriteMediaPlaylist("media/x/index.m3u8", "42:7:720", 1800);
        expect(maximum).toBeGreaterThan(1);
        expect(maximum).toBeLessThanOrEqual(32);
    });
});

describe("buildManifest — orkiestracja", () => {
    it("brak renditionow (asset nieready lub nieznany) -> not_found", async () => {
        findReadyHlsAsset.mockResolvedValue(null);
        await expect(buildManifest(42, 7, "X", "01.mp4", "master", 1999999999, "/api/hls")).resolves.toEqual({
            ok: false,
            code: "not_found",
        });
    });

    it("wariant master -> sukces, buduje playliste glowna bez dotykania B2", async () => {
        findReadyHlsAsset.mockResolvedValue(readyAsset([{ height: 720, width: 1280, bitrateKbps: 2500, playlistKey: "x" }]));
        const result = await buildManifest(42, 7, "Frieren", "01.mp4", "master", 1999999999, "/api/hls");
        expect(result.ok).toBe(true);
        expect(fetchObjectText).not.toHaveBeenCalled();
    });

    it("zadany wariant nie istnieje wsrod renditionow -> variant_not_found", async () => {
        findReadyHlsAsset.mockResolvedValue(readyAsset([{ height: 480, width: 854, bitrateKbps: 1200, playlistKey: "x" }]));
        await expect(buildManifest(42, 7, "Frieren", "01.mp4", "1080", 1999999999, "/api/hls")).resolves.toEqual({
            ok: false,
            code: "variant_not_found",
        });
    });

    it("wariant istnieje -> przepisuje playliste z B2", async () => {
        findReadyHlsAsset.mockResolvedValue(readyAsset([{ height: 720, width: 1280, bitrateKbps: 2500, playlistKey: "media/x/720p/index.m3u8" }]));
        fetchObjectText.mockResolvedValue("#EXTINF:6.0,\n000.m4s\n");
        presignedObjectUrl.mockResolvedValue("signed-url");

        const result = await buildManifest(42, 7, "Frieren", "01.mp4", "720", 1999999999, "/api/hls");
        expect(result).toEqual({ ok: true, body: expect.stringContaining("signed-url") });
    });

    it("playlista niedostepna w B2 -> storage", async () => {
        findReadyHlsAsset.mockResolvedValue(readyAsset([{ height: 720, width: 1280, bitrateKbps: 2500, playlistKey: "x" }]));
        fetchObjectText.mockResolvedValue(null);

        await expect(buildManifest(42, 7, "Frieren", "01.mp4", "720", 1999999999, "/api/hls")).resolves.toEqual({
            ok: false,
            code: "storage",
        });
    });

    it("blad bazy -> server", async () => {
        findReadyHlsAsset.mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));
        await expect(buildManifest(42, 7, "Frieren", "01.mp4", "master", 1999999999, "/api/hls")).resolves.toEqual({
            ok: false,
            code: "server",
        });
    });

    it("brak konfiguracji B2 -> storage, nie server", async () => {
        findReadyHlsAsset.mockRejectedValueOnce(new MockB2ConfigError("brak env"));
        await expect(buildManifest(42, 7, "Frieren", "01.mp4", "master", 1999999999, "/api/hls")).resolves.toEqual({
            ok: false,
            code: "storage",
        });
    });
});
