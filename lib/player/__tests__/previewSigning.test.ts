import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { PreviewGrant } from "../previewSigning";

const ORIGINAL_ENV = { ...process.env };
const grant: PreviewGrant = {
    kind: "hls",
    profileId: 11,
    assetId: 42,
    assetVersion: 7,
    seriesKey: "Frieren",
    episodeKey: "01.mp4",
    variant: 720,
    firstSegment: 14,
    lastSegment: 16,
    expiresAt: 1999999999,
};

beforeEach(() => { process.env.VIDEO_SIGNING_SECRET = "test-video-secret-do-not-use-in-prod"; });
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

describe("podpis grantu preview v2", () => {
    it("jest zgodny z niezaleznym wektorem HMAC", async () => {
        const { signPreviewGrant } = await import("../previewSigning");
        const derivedKey = createHmac("sha256", "test-video-secret-do-not-use-in-prod")
            .update("nocturna/preview-grant/v2").digest();
        const payload = ["v2", "hls", "11", "42", "7", "Frieren", "01.mp4", "720", "14", "16", "1999999999"].join("\n");
        expect(signPreviewGrant(grant)).toBe(createHmac("sha256", derivedKey).update(payload).digest("hex"));
    });

    it("odrzuca zmiane profilu, assetu, wersji, wariantu i zakresu", async () => {
        const { signPreviewGrant, verifyPreviewGrant } = await import("../previewSigning");
        const signature = signPreviewGrant(grant);
        expect(verifyPreviewGrant(grant, signature)).toBe(true);
        for (const changed of [
            { ...grant, profileId: 12 },
            { ...grant, assetId: 43 },
            { ...grant, assetVersion: 8 },
            { ...grant, variant: 480 },
            { ...grant, firstSegment: 13 },
            { ...grant, lastSegment: 17 },
            { ...grant, expiresAt: 1999999998 },
        ]) expect(verifyPreviewGrant(changed, signature)).toBe(false);
    });

    it("parser odrzuca ujemne identyfikatory i zachowuje zakres clip -1", async () => {
        const { parsePreviewGrant } = await import("../previewSigning");
        const query = new URLSearchParams({ k: "clip", p: "11", a: "42", ver: "7", s: "A", e: "01.mp4", v: "0", from: "-1", to: "-1", exp: "1999999999", sig: "x" });
        expect(parsePreviewGrant(query)?.grant.firstSegment).toBe(-1);
        query.set("p", "-1");
        expect(parsePreviewGrant(query)).toBeNull();
    });
});
