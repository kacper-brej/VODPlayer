import "server-only";
import { DatabaseError } from "@/lib/db/errors";
import { findReadyHlsAsset, type HlsRendition } from "@/lib/player/hlsRepository";
import { presignedObjectUrl, fetchObjectText, B2ConfigError } from "@/lib/player/b2Storage";
import { signHlsManifestRequest, type HlsVariant } from "@/lib/player/hlsSigning";

export const HLS_MANIFEST_PATH = "/api/hls";

const MEDIA_PLAYLIST_CACHE_TTL_MS = 60 * 60 * 1000;
const MEDIA_PLAYLIST_CACHE_MAX_ENTRIES = 128;
const PRESIGN_CONCURRENCY = 32;
const INIT_SEGMENT_FILENAME = "init.mp4";
const INIT_MAP_PREFIX = `#EXT-X-MAP:URI="${INIT_SEGMENT_FILENAME}"`;

interface CachedMediaPlaylistTemplate {
    body: string;
    expiresAt: number;
}

const mediaPlaylistCache = new Map<string, CachedMediaPlaylistTemplate>();
const mediaPlaylistRequests = new Map<string, Promise<string | null>>();

export const segmentPresignTtlSeconds = (durationSeconds: number | null): number =>
    Math.min(7200, Math.max(900, Math.ceil(durationSeconds ?? 1800) + 600));

export const buildMasterPlaylist = (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    renditions: HlsRendition[],
    expiresAt: number,
    manifestPath: string,
): string => {
    const ordered = [...renditions].sort((a, b) => a.bitrateKbps - b.bitrateKbps);
    const lines = ["#EXTM3U", "#EXT-X-VERSION:7"];

    for (const rendition of ordered) {
        const variant = String(rendition.height);
        const signature = signHlsManifestRequest(assetId, assetVersion, seriesKey, episodeKey, variant, expiresAt);
        const query = new URLSearchParams({
            a: String(assetId),
            ver: String(assetVersion),
            s: seriesKey,
            e: episodeKey,
            v: variant,
            exp: String(expiresAt),
            sig: signature,
        });

        let streamInf = `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bitrateKbps * 1000}`;
        if (rendition.width !== null && rendition.width > 0) {
            streamInf += `,RESOLUTION=${rendition.width}x${rendition.height}`;
        }

        lines.push(streamInf);
        lines.push(`${manifestPath}?${query.toString()}`);
    }

    return `${lines.join("\n")}\n`;
};

const loadMediaPlaylistTemplate = async (cacheKey: string, playlistKey: string): Promise<string | null> => {
    const now = Date.now();
    const cached = mediaPlaylistCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.body;
    if (cached) mediaPlaylistCache.delete(cacheKey);

    const pending = mediaPlaylistRequests.get(cacheKey);
    if (pending) return pending;

    const request = fetchObjectText(playlistKey).then((body) => {
        if (body === null) return null;
        if (mediaPlaylistCache.size >= MEDIA_PLAYLIST_CACHE_MAX_ENTRIES) {
            const oldestKey = mediaPlaylistCache.keys().next().value;
            if (oldestKey !== undefined) mediaPlaylistCache.delete(oldestKey);
        }
        mediaPlaylistCache.set(cacheKey, { body, expiresAt: Date.now() + MEDIA_PLAYLIST_CACHE_TTL_MS });
        return body;
    }).finally(() => mediaPlaylistRequests.delete(cacheKey));

    mediaPlaylistRequests.set(cacheKey, request);
    return request;
};

const presignLines = async (lines: string[], playlistDirectory: string, ttlSeconds: number): Promise<string[]> => {
    const rewritten = [...lines];
    const work: Array<{ index: number; objectKey: string; init: boolean }> = [];
    lines.forEach((rawLine, index) => {
        const line = rawLine.replace(/\r$/, "");
        rewritten[index] = line;
        if (line.startsWith(INIT_MAP_PREFIX)) {
            work.push({ index, objectKey: `${playlistDirectory}/${INIT_SEGMENT_FILENAME}`, init: true });
        } else if (line !== "" && !line.startsWith("#")) {
            work.push({ index, objectKey: `${playlistDirectory}/${line}`, init: false });
        }
    });

    for (let offset = 0; offset < work.length; offset += PRESIGN_CONCURRENCY) {
        const batch = work.slice(offset, offset + PRESIGN_CONCURRENCY);
        const urls = await Promise.all(batch.map((item) => presignedObjectUrl(item.objectKey, ttlSeconds)));
        batch.forEach((item, index) => {
            rewritten[item.index] = item.init ? `#EXT-X-MAP:URI="${urls[index]}"` : urls[index];
        });
    }
    return rewritten;
};

export const rewriteMediaPlaylist = async (
    playlistKey: string,
    templateCacheKey: string,
    durationSeconds: number | null,
): Promise<string | null> => {
    const original = await loadMediaPlaylistTemplate(templateCacheKey, playlistKey);
    if (original === null) return null;

    const playlistDirectory = playlistKey.slice(0, playlistKey.lastIndexOf("/"));
    const rewritten = await presignLines(
        original.split("\n"),
        playlistDirectory,
        segmentPresignTtlSeconds(durationSeconds),
    );

    return rewritten.join("\n");
};

export const clearMediaPlaylistCache = (): void => {
    mediaPlaylistCache.clear();
    mediaPlaylistRequests.clear();
};

export type ManifestResult =
    | { ok: true; body: string }
    | { ok: false; code: "not_found" | "variant_not_found" | "storage" | "server" };

export const buildManifest = async (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    variant: HlsVariant,
    expiresAt: number,
    manifestPath: string,
): Promise<ManifestResult> => {
    try {
        const asset = await findReadyHlsAsset(assetId, assetVersion, seriesKey, episodeKey);
        if (!asset) return { ok: false, code: "not_found" };
        const { renditions } = asset;

        if (variant === "master") {
            return {
                ok: true,
                body: buildMasterPlaylist(asset.id, asset.version, seriesKey, episodeKey, renditions, expiresAt, manifestPath),
            };
        }

        const matching = renditions.find((rendition) => String(rendition.height) === variant);
        if (!matching) return { ok: false, code: "variant_not_found" };

        const body = await rewriteMediaPlaylist(
            matching.playlistKey,
            `${asset.id}:${asset.version}:${matching.height}`,
            asset.durationSeconds,
        );
        if (body === null) return { ok: false, code: "storage" };

        return { ok: true, body };
    } catch (error) {
        if (error instanceof B2ConfigError) {
            console.error("buildManifest: brak lub nieprawidlowa konfiguracja B2");
            return { ok: false, code: "storage" };
        }
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
