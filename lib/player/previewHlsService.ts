import "server-only";

import { B2ConfigError, fetchObjectText, presignedObjectUrl } from "@/lib/player/b2Storage";
import type { PreviewAsset, PreviewRendition } from "@/lib/player/previewRepository";

const PREVIEW_INDEX_CACHE_TTL_MS = 60 * 60 * 1000;
const PREVIEW_CACHE_MAX_ENTRIES = 256;
const PREVIEW_SEGMENT_URL_TTL_SECONDS = 180;
const MAX_PREVIEW_SEGMENTS = 8;

interface PreviewSegment {
    uri: string;
    durationSeconds: number;
    timelineStartSeconds: number;
}

interface PreviewPlaylistIndex {
    initUri: string;
    mediaSequence: number;
    targetDuration: number;
    segments: PreviewSegment[];
}

interface CacheEntry<T> { value: T; expiresAt: number }
const indexCache = new Map<string, CacheEntry<PreviewPlaylistIndex>>();
const indexRequests = new Map<string, Promise<PreviewPlaylistIndex | null>>();
const rangeCache = new Map<string, CacheEntry<PreviewSegment[]>>();

const relativeObjectName = (value: string): boolean =>
    value.length > 0 && !value.includes("..") && !/^[a-z][a-z0-9+.-]*:/iu.test(value) && !value.startsWith("/");

export const parsePreviewPlaylistIndex = (body: string): PreviewPlaylistIndex | null => {
    const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
    const mapLine = lines.find((line) => line.startsWith("#EXT-X-MAP:"));
    const initUri = mapLine?.match(/URI="([^"]+)"/u)?.[1] ?? null;
    if (!initUri || !relativeObjectName(initUri)) return null;

    const mediaSequence = Number(lines.find((line) => line.startsWith("#EXT-X-MEDIA-SEQUENCE:"))?.split(":")[1] ?? 0);
    const targetDuration = Number(lines.find((line) => line.startsWith("#EXT-X-TARGETDURATION:"))?.split(":")[1] ?? 6);
    if (!Number.isSafeInteger(mediaSequence) || mediaSequence < 0 || !Number.isFinite(targetDuration) || targetDuration <= 0) return null;

    const segments: PreviewSegment[] = [];
    let timelineStartSeconds = 0;
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.startsWith("#EXTINF:")) continue;
        const durationSeconds = Number(line.slice("#EXTINF:".length).split(",")[0]);
        const uri = lines[index + 1] ?? "";
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !relativeObjectName(uri) || uri.startsWith("#")) return null;
        segments.push({ uri, durationSeconds, timelineStartSeconds });
        timelineStartSeconds += durationSeconds;
    }
    return segments.length > 0 ? { initUri, mediaSequence, targetDuration, segments } : null;
};

const cachePut = <T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void => {
    if (cache.size >= PREVIEW_CACHE_MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { value, expiresAt: Date.now() + PREVIEW_INDEX_CACHE_TTL_MS });
};

const playlistDirectory = (playlistKey: string): string => playlistKey.slice(0, playlistKey.lastIndexOf("/"));

const loadIndex = async (
    asset: PreviewAsset,
    rendition: PreviewRendition,
): Promise<PreviewPlaylistIndex | null> => {
    const key = `${asset.id}:${asset.version}:${rendition.height}`;
    const cached = indexCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (cached) indexCache.delete(key);
    const pending = indexRequests.get(key);
    if (pending) return pending;

    const request = fetchObjectText(rendition.playlistKey)
        .then((body) => body === null ? null : parsePreviewPlaylistIndex(body))
        .then((index) => {
            if (index) cachePut(indexCache, key, index);
            return index;
        })
        .finally(() => indexRequests.delete(key));
    indexRequests.set(key, request);
    return request;
};

export const selectPreviewRendition = (
    renditions: PreviewRendition[],
    reduceData: boolean,
): PreviewRendition | null => {
    const ordered = [...renditions].sort((a, b) => a.height - b.height);
    if (reduceData) return ordered[0] ?? null;
    return ordered.find((rendition) => rendition.height >= 720) ?? ordered[0] ?? null;
};

export interface PreparedPreviewRange {
    variant: number;
    firstSegment: number;
    lastSegment: number;
    mediaOffsetSeconds: number;
}

export const preparePreviewRange = async (
    asset: PreviewAsset,
    startSeconds: number,
    durationSeconds: number,
    reduceData: boolean,
): Promise<PreparedPreviewRange | null> => {
    const rendition = selectPreviewRendition(asset.renditions, reduceData);
    if (!rendition) return null;
    const index = await loadIndex(asset, rendition);
    if (!index) return null;

    const firstSegment = index.segments.findIndex((segment) =>
        segment.timelineStartSeconds + segment.durationSeconds > startSeconds
    );
    if (firstSegment < 0) return null;
    const requestedEnd = startSeconds + durationSeconds;
    let lastSegment = firstSegment;
    while (
        lastSegment + 1 < index.segments.length
        && index.segments[lastSegment + 1].timelineStartSeconds < requestedEnd
        && lastSegment - firstSegment + 1 < MAX_PREVIEW_SEGMENTS
    ) lastSegment += 1;

    return {
        variant: rendition.height,
        firstSegment,
        lastSegment,
        mediaOffsetSeconds: Math.max(0, startSeconds - index.segments[firstSegment].timelineStartSeconds),
    };
};

export type ShortPreviewManifestResult =
    | { ok: true; body: string }
    | { ok: false; code: "not_found" | "storage" | "invalid" };

export const buildShortPreviewManifest = async (
    asset: PreviewAsset,
    variant: number,
    firstSegment: number,
    lastSegment: number,
): Promise<ShortPreviewManifestResult> => {
    try {
        if (
            !Number.isSafeInteger(firstSegment) || !Number.isSafeInteger(lastSegment)
            || firstSegment < 0 || lastSegment < firstSegment
            || lastSegment - firstSegment + 1 > MAX_PREVIEW_SEGMENTS
        ) return { ok: false, code: "invalid" };

        const rendition = asset.renditions.find((item) => item.height === variant);
        if (!rendition) return { ok: false, code: "not_found" };
        const index = await loadIndex(asset, rendition);
        if (!index || lastSegment >= index.segments.length) return { ok: false, code: "invalid" };

        const rangeKey = `${asset.id}:${asset.version}:${variant}:${firstSegment}:${lastSegment}`;
        const cachedRange = rangeCache.get(rangeKey);
        let segments = cachedRange && cachedRange.expiresAt > Date.now() ? cachedRange.value : null;
        if (!segments) {
            segments = index.segments.slice(firstSegment, lastSegment + 1);
            cachePut(rangeCache, rangeKey, segments);
        }

        const directory = playlistDirectory(rendition.playlistKey);
        const [initUrl, ...segmentUrls] = await Promise.all([
            presignedObjectUrl(`${directory}/${index.initUri}`, PREVIEW_SEGMENT_URL_TTL_SECONDS),
            ...segments.map((segment) => presignedObjectUrl(`${directory}/${segment.uri}`, PREVIEW_SEGMENT_URL_TTL_SECONDS)),
        ]);
        const lines = [
            "#EXTM3U",
            "#EXT-X-VERSION:7",
            `#EXT-X-TARGETDURATION:${Math.ceil(index.targetDuration)}`,
            "#EXT-X-PLAYLIST-TYPE:VOD",
            `#EXT-X-MEDIA-SEQUENCE:${index.mediaSequence + firstSegment}`,
            `#EXT-X-MAP:URI="${initUrl}"`,
        ];
        segments.forEach((segment, itemIndex) => {
            lines.push(`#EXTINF:${segment.durationSeconds.toFixed(3)},`);
            lines.push(segmentUrls[itemIndex]);
        });
        lines.push("#EXT-X-ENDLIST");
        return { ok: true, body: `${lines.join("\n")}\n` };
    } catch (error) {
        if (error instanceof B2ConfigError) return { ok: false, code: "storage" };
        return { ok: false, code: "storage" };
    }
};

export const clearPreviewPlaylistCache = (): void => {
    indexCache.clear();
    indexRequests.clear();
    rangeCache.clear();
};
