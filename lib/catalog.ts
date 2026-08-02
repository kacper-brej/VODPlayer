import { cache } from "react";
import { CATALOG_REVALIDATE_SECONDS, CATALOG_TAG, VOD_ORIGIN, serviceHeaders } from "@/lib/vodConfig";
import {
    validateCatalogResponse,
    type CatalogEpisodePayload,
    type CatalogSeriesPayload,
} from "@/lib/contracts";
import { signedEpisodeUrl } from "@/lib/videoAccess";
import { resolveArtwork } from "@/lib/imageDelivery";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

export const FALLBACK_COVER = "/fallback-cover.jpg";
export const LEGACY_LOCAL_ID_OFFSET = 90000;
export const STABLE_LOCAL_ID_OFFSET = 1000000;

export type CatalogEpisode = CatalogEpisodePayload & { url: string };
export type CatalogSeries = Omit<CatalogSeriesPayload, "coverImage" | "rating" | "episodes"> & {
    coverImage: string;
    rating: string;
    bannerImage: string | null;
    sourceCoverImage: string | null;
    sourceRating: string | null;
    episodes: CatalogEpisode[];
};

const loadCatalog = async (): Promise<DataResult<CatalogSeries[]>> => {
    try {
        const res = await fetch(`${VOD_ORIGIN}/catalog.php`, {
            headers: serviceHeaders(),
            next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAG] },
        });

        if (!res.ok) {
            console.error("Catalog request failed:", res.status);
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateCatalogResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        const series: CatalogSeries[] = result.data.series.map((entry) => {
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
                episodes: entry.episodes.map((episode) => ({
                    ...episode,
                    url: signedEpisodeUrl(entry.key, episode.key),
                })),
            };
        });

        return series.length === 0
            ? dataEmpty(series)
            : dataSuccess(series);
    } catch (error) {
        console.error("Catalog request failed:", error);
        return dataFailure("network");
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
