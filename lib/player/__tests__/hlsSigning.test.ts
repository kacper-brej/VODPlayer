import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    process.env.VIDEO_SIGNING_SECRET = "test-video-secret-do-not-use-in-prod";
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe("signHlsManifestRequest / verifyHlsManifestSignature", () => {
    it("podpis zgadza się z niezależnie policzonym wektorem referencyjnym (podwójny HMAC-SHA256)", async () => {
        const { signHlsManifestRequest } = await import("../hlsSigning");

        const derivedKey = createHmac("sha256", "test-video-secret-do-not-use-in-prod")
            .update("nocturna/hls-manifest/v2")
            .digest();
        const payload = ["v2", "42", "7", "Tokyo Ghoul", "01.mp4", "720", "1999999999"].join("\n");
        const expected = createHmac("sha256", derivedKey).update(payload).digest("hex");

        expect(signHlsManifestRequest(42, 7, "Tokyo Ghoul", "01.mp4", "720", 1999999999)).toBe(expected);
    });

    it("weryfikacja przechodzi dla poprawnego podpisu", async () => {
        const { signHlsManifestRequest, verifyHlsManifestSignature } = await import("../hlsSigning");
        const signature = signHlsManifestRequest(42, 7, "Frieren", "01.mp4", "master", 1999999999);

        expect(verifyHlsManifestSignature(42, 7, "Frieren", "01.mp4", "master", 1999999999, signature)).toBe(true);
    });

    it("wielkość liter podpisu nie ma znaczenia przy weryfikacji (jak w PHP strtolower)", async () => {
        const { signHlsManifestRequest, verifyHlsManifestSignature } = await import("../hlsSigning");
        const signature = signHlsManifestRequest(42, 7, "Frieren", "01.mp4", "master", 1999999999);

        expect(verifyHlsManifestSignature(42, 7, "Frieren", "01.mp4", "master", 1999999999, signature.toUpperCase())).toBe(true);
    });

    it("zmiana dowolnego pola payloadu unieważnia podpis", async () => {
        const { signHlsManifestRequest, verifyHlsManifestSignature } = await import("../hlsSigning");
        const signature = signHlsManifestRequest(42, 7, "Frieren", "01.mp4", "master", 1999999999);

        expect(verifyHlsManifestSignature(43, 7, "Frieren", "01.mp4", "master", 1999999999, signature)).toBe(false);
        expect(verifyHlsManifestSignature(42, 8, "Frieren", "01.mp4", "master", 1999999999, signature)).toBe(false);
        expect(verifyHlsManifestSignature(42, 7, "Frieren", "02.mp4", "master", 1999999999, signature)).toBe(false);
        expect(verifyHlsManifestSignature(42, 7, "Frieren", "01.mp4", "720", 1999999999, signature)).toBe(false);
        expect(verifyHlsManifestSignature(42, 7, "Frieren", "01.mp4", "master", 1999999998, signature)).toBe(false);
    });

    it("podpis o nieprawidłowej długości jest odrzucany bez liczenia HMAC", async () => {
        const { verifyHlsManifestSignature } = await import("../hlsSigning");
        expect(verifyHlsManifestSignature(42, 7, "Frieren", "01.mp4", "master", 1999999999, "za-krotki")).toBe(false);
        expect(verifyHlsManifestSignature(42, 7, "Frieren", "01.mp4", "master", 1999999999, "a".repeat(65))).toBe(false);
    });

    it("pusty podpis jest odrzucany", async () => {
        const { verifyHlsManifestSignature } = await import("../hlsSigning");
        expect(verifyHlsManifestSignature(42, 7, "Frieren", "01.mp4", "master", 1999999999, "")).toBe(false);
    });
});

describe("isHlsVariant", () => {
    it("akceptuje dokladnie cztery znane warianty", async () => {
        const { isHlsVariant } = await import("../hlsSigning");
        expect(isHlsVariant("master")).toBe(true);
        expect(isHlsVariant("480")).toBe(true);
        expect(isHlsVariant("720")).toBe(true);
        expect(isHlsVariant("1080")).toBe(true);
        expect(isHlsVariant("2160")).toBe(false);
        expect(isHlsVariant("")).toBe(false);
    });
});
