import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CATALOG_REVALIDATE_SECONDS, CATALOG_TAG } from "@/lib/core/vodConfig";
import {
    type CatalogEpisodePayload,
    type CatalogResponse,
    type CatalogSeriesPayload,
    type SeriesAccessLevel,
} from "@/lib/core/contracts";
import { signedFileStreamUrl, signedManifestUrl } from "@/lib/player/videoAccess";
import { getViewerEntitlements, type ViewerEntitlements } from "@/lib/access/entitlements";
import { getDemoAsset, type DemoAsset } from "@/lib/access/demoAsset";
import { buildCatalog } from "@/lib/catalog/catalogService";
import { resolveArtwork } from "@/lib/catalog/imageDelivery";
import { getVirtualTmdbTitle, parseVirtualTmdbRef } from "@/lib/catalog/tmdbVirtualSeries";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";

export const FALLBACK_COVER = "/fallback-cover.jpg";
export const LEGACY_LOCAL_ID_OFFSET = 90000;
export const STABLE_LOCAL_ID_OFFSET = 1000000;

export type CatalogEpisode = CatalogEpisodePayload & { url: string | null };
export type CatalogSeries = Omit<CatalogSeriesPayload, "coverImage" | "rating" | "episodes"> & {
    coverImage: string;
    rating: string;
    bannerImage: string | null;
    sourceCoverImage: string | null;
    sourceRating: string | null;
    access: SeriesAccessLevel;
    episodes: CatalogEpisode[];
};

export const loadCatalogPayload = unstable_cache(
    buildCatalog,
    ["catalog-from-media-assets-v2"],
    { tags: [CATALOG_TAG], revalidate: CATALOG_REVALIDATE_SECONDS },
);

const episodeUrl = (
    access: SeriesAccessLevel,
    seriesKey: string,
    episode: CatalogEpisodePayload,
    demo: DemoAsset | null,
): string | null => {
    if (access === "full") {
        if (episode.media!.delivery === "file") {
            return signedFileStreamUrl(seriesKey, episode.key);
        }
        return signedManifestUrl(
            episode.media!.assetId,
            episode.media!.assetVersion,
            seriesKey,
            episode.key,
            "master",
        );
    }

    if (!demo) return null;

    return signedManifestUrl(
        demo.assetId,
        demo.assetVersion,
        demo.seriesKey,
        demo.episodeKey,
        "master",
    );
};

export const applyViewerAccess = (
    payload: CatalogResponse,
    entitlements: ViewerEntitlements,
    demo: DemoAsset | null = null,
    includePlaybackUrls = true,
): CatalogSeries[] => payload.series.map((entry) => {
    const access = entitlements.accessFor(entry.key, entry.visibility);
    const resolvedCoverImage = entry.posterImage || entry.coverImage;
    const artwork = resolveArtwork({
        poster: resolvedCoverImage,
        backdrop: entry.backdropImage,
        logo: entry.logoImage,
    });

    return {
        ...entry,
        sourceCoverImage: artwork.poster,
        sourceRating: entry.rating,
        coverImage: artwork.poster || FALLBACK_COVER,
        posterImage: artwork.poster,
        backdropImage: artwork.backdrop,
        logoImage: artwork.logo,
        rating: entry.rating || "Local",
        bannerImage: artwork.backdrop,
        access,
        episodes: entry.episodes.map((episode) => ({
            ...episode,
            url: includePlaybackUrls ? episodeUrl(access, entry.key, episode, demo) : null,
        })),
    };
});

const loadCatalog = async (includePlaybackUrls = true): Promise<DataResult<CatalogSeries[]>> => {
    try {
        const [payload, entitlements, demo] = await Promise.all([
            loadCatalogPayload(),
            getViewerEntitlements(),
            includePlaybackUrls ? getDemoAsset() : null,
        ]);
        const series = applyViewerAccess(payload, entitlements, demo, includePlaybackUrls);

        return series.length === 0
            ? dataEmpty(series)
            : dataSuccess(series);
    } catch (error) {
        console.error("Catalog request failed:", error);
        return dataFailure("server");
    }
};

export const getCatalog = cache(loadCatalog);

export const getCatalogSeriesByKey = cache(async (key: string): Promise<DataResult<CatalogSeries | null>> => {
    const result = await getCatalog();
    if (result.kind === "error") return result;

    const series = result.data.find((entry) => entry.key === key) ?? null;
    return series ? dataSuccess(series) : dataEmpty(null);
});

export const resolveCatalogSeries = cache(async (
    query: string,
    includePlaybackUrls = true,
): Promise<DataResult<CatalogSeries | null>> => {
    try {
        const [payload, entitlements, demo] = await Promise.all([
            loadCatalogPayload(),
            getViewerEntitlements(),
            includePlaybackUrls ? getDemoAsset() : null,
        ]);
        let entry = payload.series.find((series) => series.key === query || String(series.id) === query);

        if (!entry) {
            const virtualRef = parseVirtualTmdbRef(query);
            if (virtualRef !== null) return await getVirtualTmdbTitle(virtualRef);

            const legacyId = Number(query);
            const legacyIndex = legacyId - LEGACY_LOCAL_ID_OFFSET;
            const stableId = STABLE_LOCAL_ID_OFFSET + legacyIndex;
            if (Number.isInteger(legacyId) && legacyIndex >= 0) {
                entry = payload.series.find((series) => series.id === stableId) ?? payload.series[legacyIndex];
            }
        }

        if (!entry) return dataEmpty(null);

        const [series] = applyViewerAccess(
            { ...payload, series: [entry] }, entitlements, demo, includePlaybackUrls,
        );
        return dataSuccess(series);
    } catch (error) {
        console.error("Catalog series request failed:", error);
        return dataFailure("server");
    }
});
