import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "test-video-secret-do-not-use-in-prod";
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    process.env.VIDEO_SIGNING_SECRET = SECRET;
    process.env.MEDIA_FILE_ORIGIN = "https://pliki.example.test";
});
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

// Niezalezne odtworzenie tego, co robi backend-php/video_signing.php.
// Jesli ten test zacznie padac, kontrakt rozjechal sie z PHP - popraw obie strony.
const phpSideSignature = (seriesKey: string, episodeKey: string, expiresAt: number): string => {
    const key = createHmac("sha256", SECRET).update("nocturna/video-stream/v1").digest();
    const payload = ["v1", seriesKey, episodeKey, String(expiresAt)].join("\n");
    return createHmac("sha256", key).update(payload).digest("hex");
};

describe("podpis adresu do stream.php", () => {
    it("zgadza sie co do bajta z implementacja PHP", async () => {
        const { signFileStreamRequest } = await import("../fileSigning");
        expect(signFileStreamRequest("Tokyo Ghoul √A", "01.mp4", 1999999999))
            .toBe(phpSideSignature("Tokyo Ghoul √A", "01.mp4", 1999999999));
    });

    it("zmiana dowolnego pola ladunku zmienia podpis", async () => {
        const { signFileStreamRequest } = await import("../fileSigning");
        const base = signFileStreamRequest("Frieren", "01.mp4", 1999999999);
        expect(signFileStreamRequest("Frieren", "02.mp4", 1999999999)).not.toBe(base);
        expect(signFileStreamRequest("Frieren ", "01.mp4", 1999999999)).not.toBe(base);
        expect(signFileStreamRequest("Frieren", "01.mp4", 1999999998)).not.toBe(base);
    });

    it("nie reuzywa klucza kontekstu HLS", async () => {
        const { signFileStreamRequest } = await import("../fileSigning");
        const { signHlsManifestRequest } = await import("../hlsSigning");
        expect(signFileStreamRequest("Frieren", "01.mp4", 1999999999))
            .not.toBe(signHlsManifestRequest(1, 1, "Frieren", "01.mp4", "master", 1999999999));
    });

    it("weryfikacja odrzuca podpis o zlej dlugosci i cudzy podpis", async () => {
        const { signFileStreamRequest, verifyFileStreamSignature } = await import("../fileSigning");
        const good = signFileStreamRequest("Frieren", "01.mp4", 1999999999);
        expect(verifyFileStreamSignature("Frieren", "01.mp4", 1999999999, good)).toBe(true);
        expect(verifyFileStreamSignature("Frieren", "01.mp4", 1999999999, good.toUpperCase())).toBe(true);
        expect(verifyFileStreamSignature("Frieren", "01.mp4", 1999999999, "abc")).toBe(false);
        expect(verifyFileStreamSignature("Frieren", "02.mp4", 1999999999, good)).toBe(false);
    });
});

describe("adres pliku", () => {
    it("wskazuje stream.php na skonfigurowanym originie i niesie komplet parametrow", async () => {
        const { signedFileStreamUrl } = await import("../videoAccess");
        const url = new URL(signedFileStreamUrl("Frieren", "01.mp4", 1999999999));

        expect(url.origin).toBe("https://pliki.example.test");
        expect(url.pathname).toBe("/stream.php");
        expect(url.searchParams.get("s")).toBe("Frieren");
        expect(url.searchParams.get("e")).toBe("01.mp4");
        expect(url.searchParams.get("exp")).toBe("1999999999");
        expect(url.searchParams.get("sig")).toBe(phpSideSignature("Frieren", "01.mp4", 1999999999));
    });

    it("brak originu jest bledem konfiguracji, nie cichym adresem wzglednym", async () => {
        delete process.env.MEDIA_FILE_ORIGIN;
        const { signedFileStreamUrl } = await import("../videoAccess");
        expect(() => signedFileStreamUrl("Frieren", "01.mp4", 1999999999)).toThrow();
    });
});
