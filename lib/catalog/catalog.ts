import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CATALOG_REVALIDATE_SECONDS, CATALOG_TAG } from "@/lib/core/vodConfig";
import {
    type CatalogEpisodePayload,
    type CatalogResponse,
    type CatalogSeriesPayload,
    type SeriesAccessLevel,
} from "@/lib/core/contracts";
import { signedManifestUrl } from "@/lib/player/videoAccess";
import { getViewerEntitlements, type ViewerEntitlements } from "@/lib/access/entitlements";
import { getDemoAsset, type DemoAsset } from "@/lib/access/demoAsset";
import { buildCatalog } from "@/lib/catalog/catalogService";
import { resolveArtwork } from "@/lib/catalog/imageDelivery";
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

const loadCatalogPayload = unstable_cache(
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
            url: episodeUrl(access, entry.key, episode, demo),
        })),
    };
});

const loadCatalog = async (): Promise<DataResult<CatalogSeries[]>> => {
    try {
        const [payload, entitlements, demo] = await Promise.all([
            loadCatalogPayload(),
            getViewerEntitlements(),
            getDemoAsset(),
        ]);
        const series = applyViewerAccess(payload, entitlements, demo);

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

export const resolveCatalogSeries = cache(async (query: string): Promise<DataResult<CatalogSeries | null>> => {
    const result = await getCatalog();
    if (result.kind === "error") return result;

    const directMatch = result.data.find((entry) => entry.key === query || String(entry.id) === query);

    if (directMatch) return dataSuccess(directMatch);

    const legacyId = Number(query);
    const legacyIndex = legacyId - LEGACY_LOCAL_ID_OFFSET;
    const stableId = STABLE_LOCAL_ID_OFFSET + legacyIndex;
    const series = Number.isInteger(legacyId) && legacyIndex >= 0
        ? result.data.find((entry) => entry.id === stableId) ?? result.data[legacyIndex] ?? null
        : null;

    return series ? dataSuccess(series) : dataEmpty(null);
});
