import { createHmac } from "node:crypto";
import { VOD_ORIGIN } from "@/lib/vodConfig";

const SIGNATURE_VERSION = "v1";
const SIGNATURE_CONTEXT = "nocturna/video-stream/v1";

export const VIDEO_URL_TTL_SECONDS = 21600;

const signingBase = () => {
    const base = process.env.VIDEO_SIGNING_SECRET ?? process.env.JWT_SECRET;

    if (!base) {
        throw new Error("Missing VIDEO_SIGNING_SECRET / JWT_SECRET for video URL signing");
    }

    return base;
};

const signingKey = () => createHmac("sha256", signingBase()).update(SIGNATURE_CONTEXT).digest();

export const signedEpisodeUrl = (
    seriesKey: string,
    episodeKey: string,
    expiresAt = Math.floor(Date.now() / 1000) + VIDEO_URL_TTL_SECONDS,
) => {
    const payload = [SIGNATURE_VERSION, seriesKey, episodeKey, String(expiresAt)].join("\n");
    const signature = createHmac("sha256", signingKey()).update(payload).digest("hex");

    const query = new URLSearchParams({
        s: seriesKey,
        e: episodeKey,
        exp: String(expiresAt),
        sig: signature,
    });

    return `${VOD_ORIGIN}/stream.php?${query.toString()}`;
};
