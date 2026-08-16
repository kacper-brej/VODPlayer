import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { videoSigningBase } from "@/lib/player/signingSecret";

// Kontrakt odwzorowuje backend-php/video_signing.php (wariant video-stream v1).
// Każda zmiana tutaj wymaga tej samej zmiany po stronie PHP i odwrotnie -
// obie strony liczą HMAC z tego samego sekretu, ale własnego łańcucha kontekstu.
const SIGNATURE_VERSION = "v1";
const FILE_STREAM_SIGNATURE_CONTEXT = "nocturna/video-stream/v1";

export const FILE_STREAM_URL_TTL_SECONDS = 6 * 60 * 60;

const streamSigningKey = () =>
    createHmac("sha256", videoSigningBase()).update(FILE_STREAM_SIGNATURE_CONTEXT).digest();

export const fileStreamSignaturePayload = (
    seriesKey: string,
    episodeKey: string,
    expiresAt: number,
): string => [SIGNATURE_VERSION, seriesKey, episodeKey, String(expiresAt)].join("\n");

export const signFileStreamRequest = (
    seriesKey: string,
    episodeKey: string,
    expiresAt: number,
): string =>
    createHmac("sha256", streamSigningKey())
        .update(fileStreamSignaturePayload(seriesKey, episodeKey, expiresAt))
        .digest("hex");

export const verifyFileStreamSignature = (
    seriesKey: string,
    episodeKey: string,
    expiresAt: number,
    signature: string,
): boolean => {
    if (signature.length !== 64) return false;
    const expected = Buffer.from(signFileStreamRequest(seriesKey, episodeKey, expiresAt), "utf8");
    const provided = Buffer.from(signature.toLowerCase(), "utf8");
    return expected.length === provided.length && timingSafeEqual(expected, provided);
};
