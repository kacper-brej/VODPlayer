import { createHmac } from "node:crypto";
import { VOD_ORIGIN } from "@/lib/vodConfig";
import type { CatalogEpisode } from "@/lib/catalog";

const SIGNATURE_VERSION = "v1";
const SIGNATURE_CONTEXT = "nocturna/video-stream/v1";
const HLS_MANIFEST_SIGNATURE_CONTEXT = "nocturna/hls-manifest/v1";
const PREVIEW_CLIP_SIGNATURE_CONTEXT = "nocturna/preview-clip/v1";

export const VIDEO_URL_TTL_SECONDS = 21600;
export const HLS_MANIFEST_URL_TTL_SECONDS = 21600;
export const PREVIEW_CLIP_URL_TTL_SECONDS = 21600;

const signingBase = () => {
    const base = process.env.VIDEO_SIGNING_SECRET ?? process.env.JWT_SECRET;

    if (!base) {
        throw new Error("Missing VIDEO_SIGNING_SECRET / JWT_SECRET for video URL signing");
    }

    return base;
};

const signingKey = () => createHmac("sha256", signingBase()).update(SIGNATURE_CONTEXT).digest();
const hlsManifestSigningKey = () => createHmac("sha256", signingBase()).update(HLS_MANIFEST_SIGNATURE_CONTEXT).digest();
const previewClipSigningKey = () => createHmac("sha256", signingBase()).update(PREVIEW_CLIP_SIGNATURE_CONTEXT).digest();

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

export type HlsManifestVariant = "master" | "480" | "720" | "1080";

export const signedManifestUrl = (
    seriesKey: string,
    episodeKey: string,
    variant: HlsManifestVariant,
    expiresAt = Math.floor(Date.now() / 1000) + HLS_MANIFEST_URL_TTL_SECONDS,
): string => {
    const payload = [SIGNATURE_VERSION, seriesKey, episodeKey, variant, String(expiresAt)].join("\n");
    const signature = createHmac("sha256", hlsManifestSigningKey()).update(payload).digest("hex");

    const query = new URLSearchParams({
        s: seriesKey,
        e: episodeKey,
        v: variant,
        exp: String(expiresAt),
        sig: signature,
    });

    return `${VOD_ORIGIN}/hls.php?${query.toString()}`;
};

export type PlaybackSource =
    | { kind: "hls"; src: string; heights: number[] }
    | { kind: "mp4"; src: string };

export const resolvePlaybackSource = (seriesKey: string, episode: CatalogEpisode): PlaybackSource => {
    if (episode.media?.status === "ready" && episode.media.heights.length > 0) {
        return {
            kind: "hls",
            src: signedManifestUrl(seriesKey, episode.key, "master"),
            heights: episode.media.heights,
        };
    }

    return { kind: "mp4", src: signedEpisodeUrl(seriesKey, episode.key) };
};

export const signedPreviewClipUrl = (
    seriesKey: string,
    episodeKey: string,
    expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_CLIP_URL_TTL_SECONDS,
): string => {
    const payload = [SIGNATURE_VERSION, seriesKey, episodeKey, String(expiresAt)].join("\n");
    const signature = createHmac("sha256", previewClipSigningKey()).update(payload).digest("hex");

    const query = new URLSearchParams({
        s: seriesKey,
        e: episodeKey,
        exp: String(expiresAt),
        sig: signature,
    });

    return `${VOD_ORIGIN}/preview.php?${query.toString()}`;
};

export type PreviewSource =
    | { kind: "hls"; src: string; startSeconds: number }
    | { kind: "mp4"; src: string; startSeconds: number };

export const resolvePreviewSource = (
    seriesKey: string,
    episode: CatalogEpisode,
    resumePositionSeconds: number | null,
): PreviewSource | null => {
    if (resumePositionSeconds !== null && episode.media?.status === "ready" && episode.media.heights.length > 0) {
        return {
            kind: "hls",
            src: signedManifestUrl(seriesKey, episode.key, "master"),
            startSeconds: Math.max(0, resumePositionSeconds - 10),
        };
    }

    if (episode.media?.hasPreviewClip && episode.media.previewStartSeconds !== null) {
        return {
            kind: "mp4",
            src: signedPreviewClipUrl(seriesKey, episode.key),
            startSeconds: episode.media.previewStartSeconds,
        };
    }

    return null;
};
