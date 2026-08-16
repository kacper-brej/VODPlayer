import "server-only";

import { DatabaseError } from "@/lib/db/errors";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import { B2ConfigError, presignedObjectUrl } from "@/lib/player/b2Storage";
import { signedFileStreamUrl } from "@/lib/player/videoAccess";
import { decidePreview, PREVIEW_PLAYBACK_DURATION_SECONDS } from "@/lib/player/previewPolicy";
import { preparePreviewRange } from "@/lib/player/previewHlsService";
import { findGrantedPreviewAsset, findPreviewSessionAsset } from "@/lib/player/previewRepository";
import { signPreviewGrant, type PreviewGrant } from "@/lib/player/previewSigning";
import { getViewerSeriesAccessLevel } from "@/lib/access/entitlements";
import { getDemoAsset } from "@/lib/access/demoAsset";
import type { PreviewSessionSource } from "@/lib/player/previewTypes";

export const PREVIEW_SESSION_TTL_SECONDS = 90;
const PREVIEW_CLIP_PRESIGN_TTL_SECONDS = 120;

export type PreviewSessionResult =
    | { ok: true; source: PreviewSessionSource }
    | { ok: false; code: "not_found" | "storage" | "server" };

const grantUrl = (path: string, grant: PreviewGrant): string => {
    const query = new URLSearchParams({
        k: grant.kind,
        p: String(grant.profileId),
        a: String(grant.assetId),
        ver: String(grant.assetVersion),
        s: grant.seriesKey,
        e: grant.episodeKey,
        v: String(grant.variant),
        from: String(grant.firstSegment),
        to: String(grant.lastSegment),
        exp: String(grant.expiresAt),
        sig: signPreviewGrant(grant),
    });
    return `${path}?${query.toString()}`;
};

export const createPreviewSession = async (
    userId: number,
    username: string,
    seriesKey: string,
    episodeKey: string,
    reduceData: boolean,
): Promise<PreviewSessionResult> => {
    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        const access = await getViewerSeriesAccessLevel(seriesKey);
        const demo = access === "full" ? null : await getDemoAsset();
        if (access !== "full" && !demo) return { ok: false, code: "not_found" };

        const asset = await findPreviewSessionAsset(
            profileId,
            demo?.seriesKey ?? seriesKey,
            demo?.episodeKey ?? episodeKey,
            { seriesKey, episodeKey },
        );
        if (!asset) return { ok: false, code: "not_found" };

        // Materiał z pliku nie ma wariantów jakości ani segmentów, więc nie da się
        // z niego wyciąć fragmentu odcinka. Jedyny możliwy podgląd to osobny klip
        // leżący obok odcinka; decidePreview nie ma tu czego rozstrzygać (ADR-043).
        if (asset.delivery === "file") {
            if (!asset.previewClipKey) return { ok: false, code: "not_found" };
            const expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_SESSION_TTL_SECONDS;
            const grant: PreviewGrant = {
                kind: "clip",
                profileId,
                assetId: asset.id,
                assetVersion: asset.version,
                seriesKey: asset.seriesKey,
                episodeKey: asset.episodeKey,
                variant: 0,
                firstSegment: -1,
                lastSegment: -1,
                expiresAt,
            };
            return {
                ok: true,
                source: {
                    mode: "preview",
                    type: "mp4",
                    src: grantUrl("/api/preview/clip", grant),
                    expiresAt,
                    sourceTimelineStartSeconds: 0,
                    mediaOffsetSeconds: 0,
                    durationSeconds: PREVIEW_PLAYBACK_DURATION_SECONDS,
                    reason: "default",
                },
            };
        }

        const decision = decidePreview({
            assetId: asset.id,
            assetVersion: asset.version,
            durationSeconds: asset.durationSeconds,
            previewStartSeconds: asset.previewStartSeconds,
            progress: asset.progress,
        });
        if (!decision) return { ok: false, code: "not_found" };

        const expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_SESSION_TTL_SECONDS;
        const clipTimelineKnown = asset.previewStartSeconds !== null
            && Number.isFinite(asset.previewStartSeconds)
            && asset.previewStartSeconds >= 0;
        if (decision.reason !== "resume" && asset.previewClipKey && clipTimelineKnown) {
            const grant: PreviewGrant = {
                kind: "clip",
                profileId,
                assetId: asset.id,
                assetVersion: asset.version,
                seriesKey: asset.seriesKey,
                episodeKey: asset.episodeKey,
                variant: 0,
                firstSegment: -1,
                lastSegment: -1,
                expiresAt,
            };
            return {
                ok: true,
                source: {
                    mode: "preview",
                    type: "mp4",
                    src: grantUrl("/api/preview/clip", grant),
                    expiresAt,
                    sourceTimelineStartSeconds: decision.sourceTimelineStartSeconds,
                    mediaOffsetSeconds: 0,
                    durationSeconds: decision.durationSeconds,
                    reason: decision.reason,
                },
            };
        }

        const range = await preparePreviewRange(
            asset,
            decision.sourceTimelineStartSeconds,
            decision.durationSeconds,
            reduceData,
        );
        if (!range) return { ok: false, code: "storage" };
        const grant: PreviewGrant = {
            kind: "hls",
            profileId,
            assetId: asset.id,
            assetVersion: asset.version,
            seriesKey: asset.seriesKey,
            episodeKey: asset.episodeKey,
            variant: range.variant,
            firstSegment: range.firstSegment,
            lastSegment: range.lastSegment,
            expiresAt,
        };
        return {
            ok: true,
            source: {
                mode: "preview",
                type: "hls",
                src: grantUrl("/api/preview/hls", grant),
                expiresAt,
                sourceTimelineStartSeconds: decision.sourceTimelineStartSeconds,
                mediaOffsetSeconds: range.mediaOffsetSeconds,
                durationSeconds: decision.durationSeconds,
                reason: decision.reason,
            },
        };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        if (error instanceof B2ConfigError) return { ok: false, code: "storage" };
        return { ok: false, code: "storage" };
    }
};

export type PreviewClipResult =
    | { ok: true; url: string }
    | { ok: false; code: "not_found" | "storage" | "server" };

export const buildGrantedPreviewClip = async (grant: PreviewGrant): Promise<PreviewClipResult> => {
    try {
        const asset = await findGrantedPreviewAsset(
            grant.assetId, grant.assetVersion, grant.seriesKey, grant.episodeKey,
        );
        if (!asset?.previewClipKey) return { ok: false, code: "not_found" };
        if (asset.delivery === "file") {
            return { ok: true, url: signedFileStreamUrl(asset.seriesKey, asset.previewClipKey) };
        }
        return { ok: true, url: await presignedObjectUrl(asset.previewClipKey, PREVIEW_CLIP_PRESIGN_TTL_SECONDS) };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        return { ok: false, code: "storage" };
    }
};
