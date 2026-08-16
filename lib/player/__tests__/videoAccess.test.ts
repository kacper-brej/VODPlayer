import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CatalogEpisode } from "@/lib/catalog/catalog";

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => { process.env.VIDEO_SIGNING_SECRET = "test-video-secret-do-not-use-in-prod"; });
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

const baseEpisode: CatalogEpisode = {
    key: "01.mp4", number: 1, sizeBytes: 0, addedAt: 0, title: null, synopsis: null,
    durationSeconds: null, thumbnail: null, url: "", media: null,
};

describe("signedManifestUrl", () => {
    it("wskazuje na wlasny HLS i wiaze asset/version", async () => {
        const { signedManifestUrl } = await import("../videoAccess");
        const { verifyHlsManifestSignature } = await import("../hlsSigning");
        const url = signedManifestUrl(42, 7, "Frieren", "01.mp4", "720", 1999999999);
        const params = new URLSearchParams(url.split("?")[1]);
        expect(url.startsWith("/api/hls?")).toBe(true);
        expect(verifyHlsManifestSignature(42, 7, "Frieren", "01.mp4", "720", 1999999999, params.get("sig")!)).toBe(true);
    });
});

describe("resolvePlaybackSource", () => {
    it("pelny odcinek pozostaje HLS-only", async () => {
        const { resolvePlaybackSource } = await import("../videoAccess");
        const source = resolvePlaybackSource("Frieren", {
            ...baseEpisode,
            media: { assetId: 42, assetVersion: 7, status: "ready", delivery: "hls", heights: [480, 720], previewStartSeconds: null, hasPreviewClip: false },
        });
        expect(source).toMatchObject({ kind: "hls", heights: [480, 720] });
        expect(source.src).toContain("/api/hls?");
    });

    it("odcinek z pliku dostaje podpisany adres do stream.php zamiast manifestu", async () => {
        process.env.MEDIA_FILE_ORIGIN = "https://pliki.example.test";
        const { resolvePlaybackSource } = await import("../videoAccess");
        const source = resolvePlaybackSource("Tokyo Ghoul √A", {
            ...baseEpisode,
            media: { assetId: 42, assetVersion: 7, status: "ready", delivery: "file", heights: [], previewStartSeconds: null, hasPreviewClip: false },
        });

        expect(source.kind).toBe("file");
        expect(source.src).toContain("https://pliki.example.test/stream.php?");
        expect(source.src).not.toContain("/api/hls");
        expect(source).not.toHaveProperty("heights");
    });

    it("brak wariantow jakosci nie blokuje odcinka z pliku", async () => {
        process.env.MEDIA_FILE_ORIGIN = "https://pliki.example.test";
        const { resolvePlaybackSource } = await import("../videoAccess");
        expect(() => resolvePlaybackSource("Frieren", {
            ...baseEpisode,
            media: { assetId: 0, assetVersion: 0, status: "ready", delivery: "file", heights: [], previewStartSeconds: null, hasPreviewClip: false },
        })).not.toThrow();
    });
});

describe("resolvePreviewSource", () => {
    it("zwraca tylko intencje sesyjna bez podpisanego zasobu i pozycji", async () => {
        const { resolvePreviewSource } = await import("../videoAccess");
        const source = resolvePreviewSource("Frieren", {
            ...baseEpisode,
            media: { assetId: 42, assetVersion: 7, status: "ready", delivery: "hls", heights: [480, 720], previewStartSeconds: 30, hasPreviewClip: true },
        }, 125);
        expect(source).toMatchObject({ kind: "session", startSeconds: 0 });
        expect(source?.src).toContain("/api/preview?");
        expect(source?.src).not.toContain("/api/hls?");
        expect(source?.src).not.toContain("sig=");
    });

    it("brak klipu i renditionow wylacza preview", async () => {
        const { resolvePreviewSource } = await import("../videoAccess");
        expect(resolvePreviewSource("Frieren", {
            ...baseEpisode,
            media: { assetId: 42, assetVersion: 7, status: "ready", delivery: "hls", heights: [], previewStartSeconds: null, hasPreviewClip: false },
        }, 6)).toBeNull();
    });
});
