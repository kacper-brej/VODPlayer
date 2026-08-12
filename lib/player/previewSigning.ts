import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { videoSigningBase } from "@/lib/player/signingSecret";

const SIGNATURE_VERSION = "v2";
const PREVIEW_GRANT_SIGNATURE_CONTEXT = "nocturna/preview-grant/v2";

export type PreviewGrantKind = "clip" | "hls";

export interface PreviewGrant {
    kind: PreviewGrantKind;
    profileId: number;
    assetId: number;
    assetVersion: number;
    seriesKey: string;
    episodeKey: string;
    variant: number;
    firstSegment: number;
    lastSegment: number;
    expiresAt: number;
}

const previewSigningKey = () =>
    createHmac("sha256", videoSigningBase()).update(PREVIEW_GRANT_SIGNATURE_CONTEXT).digest();

export const previewGrantSignaturePayload = (grant: PreviewGrant): string => [
    SIGNATURE_VERSION,
    grant.kind,
    String(grant.profileId),
    String(grant.assetId),
    String(grant.assetVersion),
    grant.seriesKey,
    grant.episodeKey,
    String(grant.variant),
    String(grant.firstSegment),
    String(grant.lastSegment),
    String(grant.expiresAt),
].join("\n");

export const signPreviewGrant = (grant: PreviewGrant): string =>
    createHmac("sha256", previewSigningKey())
        .update(previewGrantSignaturePayload(grant))
        .digest("hex");

export const verifyPreviewGrant = (grant: PreviewGrant, signature: string): boolean => {
    if (signature.length !== 64) return false;
    const expected = Buffer.from(signPreviewGrant(grant), "hex");
    const provided = Buffer.from(signature.toLowerCase(), "hex");
    return provided.length === expected.length && timingSafeEqual(expected, provided);
};

const safeInteger = (value: string | null, allowNegativeOne = false): number | null => {
    if (value === null || !/^-?\d+$/u.test(value)) return null;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || (allowNegativeOne ? parsed < -1 : parsed < 0)) return null;
    return parsed;
};

export const parsePreviewGrant = (searchParams: URLSearchParams): { grant: PreviewGrant; signature: string } | null => {
    const kind = searchParams.get("k");
    const profileId = safeInteger(searchParams.get("p"));
    const assetId = safeInteger(searchParams.get("a"));
    const assetVersion = safeInteger(searchParams.get("ver"));
    const variant = safeInteger(searchParams.get("v"));
    const firstSegment = safeInteger(searchParams.get("from"), true);
    const lastSegment = safeInteger(searchParams.get("to"), true);
    const expiresAt = safeInteger(searchParams.get("exp"));
    const seriesKey = searchParams.get("s") ?? "";
    const episodeKey = searchParams.get("e") ?? "";
    const signature = searchParams.get("sig") ?? "";
    if (
        (kind !== "clip" && kind !== "hls")
        || profileId === null || profileId <= 0
        || assetId === null || assetId <= 0
        || assetVersion === null || variant === null
        || firstSegment === null || lastSegment === null || expiresAt === null
        || seriesKey.length === 0 || seriesKey.length > 255
        || episodeKey.length === 0 || episodeKey.length > 255
    ) return null;
    return {
        grant: {
            kind,
            profileId,
            assetId,
            assetVersion,
            seriesKey,
            episodeKey,
            variant,
            firstSegment,
            lastSegment,
            expiresAt,
        },
        signature,
    };
};
