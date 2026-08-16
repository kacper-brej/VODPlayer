import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "test-video-secret-do-not-use-in-prod";
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => { process.env.VIDEO_SIGNING_SECRET = SECRET; });
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

// Niezalezne odtworzenie backend-php/video_signing.php (wariant library-scan v1).
const phpSideSignature = (expiresAt: number): string => {
    const key = createHmac("sha256", SECRET).update("nocturna/library-scan/v1").digest();
    return createHmac("sha256", key).update(["v1", String(expiresAt)].join("\n")).digest("hex");
};

describe("podpis skanu biblioteki", () => {
    it("zgadza sie co do bajta z implementacja PHP", async () => {
        const { signLibraryScanRequest } = await import("../libraryScanSigning");
        expect(signLibraryScanRequest(1999999999)).toBe(phpSideSignature(1999999999));
    });

    it("nie jest wymienny z podpisem strumienia mimo wspolnego sekretu", async () => {
        const { signLibraryScanRequest } = await import("../libraryScanSigning");
        const { signFileStreamRequest } = await import("@/lib/player/fileSigning");
        expect(signLibraryScanRequest(1999999999))
            .not.toBe(signFileStreamRequest("", "", 1999999999));
    });

    it("kazdy termin waznosci ma wlasny podpis", async () => {
        const { signLibraryScanRequest } = await import("../libraryScanSigning");
        expect(signLibraryScanRequest(1999999999)).not.toBe(signLibraryScanRequest(1999999998));
    });
});
