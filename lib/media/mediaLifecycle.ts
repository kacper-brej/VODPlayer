export const MEDIA_ASSET_STATUSES = [
    "pending",
    "processing",
    "ready",
    "failed",
    "deleting",
    "delete_failed",
    "deleted",
] as const;

export type MediaAssetStatus = typeof MEDIA_ASSET_STATUSES[number];

export const MAX_MEDIA_RENDITIONS = 3;
export const MAX_MEDIA_SEGMENTS_PER_RENDITION = 100_000;
export const MEDIA_RENDITION_HEIGHTS = [480, 720, 1080] as const;

const encodedTraversal = /%(?:2e|2f|5c)/iu;
const unsafeSegment = /[\x00-\x1f\x7f/\\]/u;

export const isSafeMediaIdentitySegment = (value: string): boolean =>
    value.length > 0
    && value.length <= 255
    && value !== "."
    && value !== ".."
    && !value.startsWith(".")
    && !unsafeSegment.test(value)
    && !encodedTraversal.test(value);

export const canonicalMediaPrefix = (seriesKey: string, episodeKey: string): string =>
    `media/${seriesKey}/${episodeKey}`;

export const canonicalRenditionPlaylistKey = (
    seriesKey: string,
    episodeKey: string,
    height: number,
): string => `${canonicalMediaPrefix(seriesKey, episodeKey)}/${height}p/index.m3u8`;

export const canonicalPreviewClipKey = (seriesKey: string, episodeKey: string): string =>
    `${canonicalMediaPrefix(seriesKey, episodeKey)}/preview.mp4`;

export const isCanonicalMediaPrefix = (
    prefix: string,
    seriesKey: string,
    episodeKey: string,
): boolean => prefix === canonicalMediaPrefix(seriesKey, episodeKey);

export const isKeyInsideMediaPrefix = (key: string, prefix: string): boolean =>
    key.startsWith(`${prefix}/`)
    && !key.includes("\\")
    && !key.includes("//")
    && !encodedTraversal.test(key)
    && !key.includes("../")
    && !key.includes("/..");

export const normalizePreviewStart = (value: number | null, durationSeconds: number): number | null => {
    if (value === null) return null;
    return Math.min(value, Math.max(0, durationSeconds - 1));
};
