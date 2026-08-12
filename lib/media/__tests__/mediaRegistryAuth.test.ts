import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildMediaRegistryCanonicalRequest, signMediaRegistryRequest, verifyMediaRegistrySignature } from "../mediaRegistryAuth";

const originalSecret = process.env.MEDIA_REGISTRY_SECRET;
const nonce = "ab".repeat(32);

beforeEach(() => { process.env.MEDIA_REGISTRY_SECRET = "test-media-registry-secret-32bytes"; });
afterEach(() => {
    if (originalSecret === undefined) delete process.env.MEDIA_REGISTRY_SECRET;
    else process.env.MEDIA_REGISTRY_SECRET = originalSecret;
});

const signedRequest = (body: string, timestamp: number, pathname = "/api/media/register", method = "POST") => {
    const signature = signMediaRegistryRequest(process.env.MEDIA_REGISTRY_SECRET!, { method, pathname, timestamp, nonce, rawBody: body });
    return new Request(`http://localhost:3000${pathname}`, {
        method,
        headers: {
            "X-Nocturna-Version": "2",
            "X-Nocturna-Timestamp": String(timestamp),
            "X-Nocturna-Nonce": nonce,
            "X-Nocturna-Signature": signature,
        },
        body: method === "GET" ? undefined : body,
    });
};

describe("media registry HMAC v2", () => {
    it("buduje jednoznaczny canonical request z hashem body", () => {
        expect(buildMediaRegistryCanonicalRequest({ method: "post", pathname: "/api/media/register", timestamp: 1_700_000_000, nonce, rawBody: '{"phase":"start"}' }))
            .toBe(`2\nPOST\n/api/media/register\n1700000000\n${nonce}\n89de03ed840925ece73c6e276029bd3ba642b630a85f40351b5040963eb311e3`);
    });

    it("wiąże metodę, ścieżkę i body oraz ma 90 sekund tolerancji", () => {
        const timestamp = 1_700_000_000;
        const body = '{"phase":"start"}';
        const request = signedRequest(body, timestamp);
        expect(verifyMediaRegistrySignature(request, body, timestamp + 90)).toEqual({ nonce, timestamp });
        expect(verifyMediaRegistrySignature(request, body, timestamp + 91)).toBeNull();
        expect(verifyMediaRegistrySignature(request, `${body} `, timestamp)).toBeNull();
        expect(verifyMediaRegistrySignature(new Request("http://localhost:3000/api/media/status", request), body, timestamp)).toBeNull();
    });
});
