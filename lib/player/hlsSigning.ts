import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { videoSigningBase } from "@/lib/player/signingSecret";

const SIGNATURE_VERSION = "v2";
const HLS_MANIFEST_SIGNATURE_CONTEXT = "nocturna/hls-manifest/v2";

export const HLS_VARIANTS = ["master", "480", "720", "1080"] as const;
export type HlsVariant = (typeof HLS_VARIANTS)[number];

export const isHlsVariant = (value: string): value is HlsVariant =>
    (HLS_VARIANTS as readonly string[]).includes(value);

const manifestSigningKey = () =>
    createHmac("sha256", videoSigningBase()).update(HLS_MANIFEST_SIGNATURE_CONTEXT).digest();

export const hlsManifestSignaturePayload = (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    variant: string,
    expiresAt: number,
): string => [SIGNATURE_VERSION, String(assetId), String(assetVersion), seriesKey, episodeKey, variant, String(expiresAt)].join("\n");

export const signHlsManifestRequest = (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    variant: string,
    expiresAt: number,
): string =>
    createHmac("sha256", manifestSigningKey())
        .update(hlsManifestSignaturePayload(assetId, assetVersion, seriesKey, episodeKey, variant, expiresAt))
        .digest("hex");

export const verifyHlsManifestSignature = (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    variant: string,
    expiresAt: number,
    signature: string,
): boolean => {
    if (signature.length !== 64) return false;

    const expected = signHlsManifestRequest(assetId, assetVersion, seriesKey, episodeKey, variant, expiresAt);
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(signature.toLowerCase(), "hex");

    if (providedBuffer.length !== expectedBuffer.length) return false;

    return timingSafeEqual(expectedBuffer, providedBuffer);
};
