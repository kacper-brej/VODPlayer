import type { CatalogEpisode } from "@/lib/catalog/catalog";
import { signHlsManifestRequest, type HlsVariant } from "@/lib/player/hlsSigning";
import { HLS_MANIFEST_PATH } from "@/lib/player/hlsService";

export const HLS_MANIFEST_URL_TTL_SECONDS = 90;

export type HlsManifestVariant = HlsVariant;

export const signedManifestUrl = (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    variant: HlsManifestVariant,
    expiresAt = Math.floor(Date.now() / 1000) + HLS_MANIFEST_URL_TTL_SECONDS,
): string => {
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

    return `${HLS_MANIFEST_PATH}?${query.toString()}`;
};

export type PlaybackSource = { kind: "hls"; src: string; heights: number[]; expiresAt: number };

export const playbackSourceFromAsset = (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    heights: number[],
): PlaybackSource => {
    const expiresAt = Math.floor(Date.now() / 1000) + HLS_MANIFEST_URL_TTL_SECONDS;
    return {
        kind: "hls",
        src: signedManifestUrl(assetId, assetVersion, seriesKey, episodeKey, "master", expiresAt),
        heights,
        expiresAt,
    };
};

export const resolvePlaybackSource = (seriesKey: string, episode: CatalogEpisode): PlaybackSource => {
    const assetId = episode.media?.assetId;
    const assetVersion = episode.media?.assetVersion;
    if (!Number.isSafeInteger(assetId) || !Number.isSafeInteger(assetVersion)) {
        throw new Error("Brak tozsamosci gotowego assetu HLS.");
    }
    return playbackSourceFromAsset(
        assetId!, assetVersion!, seriesKey, episode.key, episode.media?.heights ?? [],
    );
};

export type PreviewSource = { kind: "session"; src: string; startSeconds: 0 };

export const resolvePreviewSource = (
    seriesKey: string,
    episode: CatalogEpisode,
    _resumePositionSeconds: number | null,
): PreviewSource | null => {
    void _resumePositionSeconds;
    if (episode.media?.status !== "ready") return null;
    if (!episode.media.hasPreviewClip && episode.media.heights.length === 0) return null;
    const query = new URLSearchParams({ s: seriesKey, e: episode.key });
    return { kind: "session", src: `/api/preview?${query.toString()}`, startSeconds: 0 };
};
