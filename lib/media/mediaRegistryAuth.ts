import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { requireSecret, type EnvSource } from "@/lib/config/env";
import { consumeMediaRequestNonce } from "@/lib/media/mediaRequestNonceRepository";

export const MEDIA_REGISTRY_SIGNATURE_VERSION = "2";
export const MEDIA_REGISTRY_SIGNATURE_CONTEXT = "nocturna/media-registry/v2";
export const MEDIA_REGISTRY_TIMESTAMP_TOLERANCE_SECONDS = 90;

export type MediaRegistrySignatureInput = Readonly<{ method: string; pathname: string; timestamp: number; nonce: string; rawBody: string }>;

export const readMediaRegistrySecret = (env: EnvSource = process.env): string => requireSecret(env, "MEDIA_REGISTRY_SECRET", 32);

export const buildMediaRegistryCanonicalRequest = (input: MediaRegistrySignatureInput): string => [
    MEDIA_REGISTRY_SIGNATURE_VERSION,
    input.method.toUpperCase(),
    input.pathname,
    String(input.timestamp),
    input.nonce.toLowerCase(),
    createHash("sha256").update(input.rawBody).digest("hex"),
].join("\n");

export const signMediaRegistryRequest = (secret: string, input: MediaRegistrySignatureInput): string => {
    const signingKey = createHmac("sha256", secret).update(MEDIA_REGISTRY_SIGNATURE_CONTEXT).digest();
    return createHmac("sha256", signingKey).update(buildMediaRegistryCanonicalRequest(input)).digest("hex");
};

export const verifyMediaRegistrySignature = (
    request: Request,
    rawBody: string,
    nowSeconds = Math.floor(Date.now() / 1000),
): { nonce: string; timestamp: number } | null => {
    const version = request.headers.get("x-nocturna-version") ?? "";
    const timestampHeader = request.headers.get("x-nocturna-timestamp") ?? "";
    const nonce = (request.headers.get("x-nocturna-nonce") ?? "").toLowerCase();
    const signature = (request.headers.get("x-nocturna-signature") ?? "").toLowerCase();
    if (version !== MEDIA_REGISTRY_SIGNATURE_VERSION || !/^\d+$/.test(timestampHeader)
        || !/^[a-f0-9]{64}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return null;
    const timestamp = Number(timestampHeader);
    if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MEDIA_REGISTRY_TIMESTAMP_TOLERANCE_SECONDS) return null;
    const expected = signMediaRegistryRequest(readMediaRegistrySecret(), {
        method: request.method,
        pathname: new URL(request.url).pathname,
        timestamp,
        nonce,
        rawBody,
    });
    if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))) return null;
    return { nonce, timestamp };
};

export const authenticateMediaRegistryRequest = async (
    request: Request,
    rawBody: string,
    nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> => {
    const verified = verifyMediaRegistrySignature(request, rawBody, nowSeconds);
    return verified ? consumeMediaRequestNonce(verified.nonce, nowSeconds + MEDIA_REGISTRY_TIMESTAMP_TOLERANCE_SECONDS) : false;
};
