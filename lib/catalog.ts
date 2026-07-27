import { cache } from "react";
import { CATALOG_REVALIDATE_SECONDS, CATALOG_TAG, VOD_ORIGIN, serviceHeaders } from "@/lib/vodConfig";

export const FALLBACK_COVER = "/fallback-cover.jpg";
export const LOCAL_ID_OFFSET = 90000;

export interface CatalogEpisode {
    key: string;
    number: number;
    url: string;
    sizeBytes: number;
    addedAt: number;
}

export interface CatalogSeries {
    id: number;
    key: string;
    title: string;
    coverImage: string;
    bannerImage: string | null;
    synopsis: string | null;
    rating: string;
    year: number | null;
    hasMetadata: boolean;
    episodeCount: number;
    episodes: CatalogEpisode[];
}

interface CatalogResponse {
    generatedAt: number;
    series: Array<Omit<CatalogSeries, "coverImage" | "rating"> & { coverImage: string | null; rating: string | null }>;
}

const loadCatalog = async (): Promise<CatalogSeries[]> => {
    try {
        const res = await fetch(`${VOD_ORIGIN}/catalog.php`, {
            headers: serviceHeaders(),
            next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAG] },
        });

        if (!res.ok) return [];

        const payload = (await res.json()) as CatalogResponse;

        if (!Array.isArray(payload?.series)) return [];

        return payload.series.map((series) => ({
            ...series,
            coverImage: series.coverImage || FALLBACK_COVER,
            rating: series.rating || "Local",
        }));
    } catch (error) {
        console.error("catalog fetch failed", error);
        return [];
    }
};

export const getCatalog = cache(loadCatalog);

export const getCatalogSeriesById = cache(async (id: number): Promise<CatalogSeries | null> => {
    const catalog = await getCatalog();
    return catalog.find((series) => series.id === id) ?? null;
});

export const getCatalogSeriesByKey = cache(async (key: string): Promise<CatalogSeries | null> => {
    const catalog = await getCatalog();
    return catalog.find((series) => series.key === key) ?? null;
});

export const resolveCatalogSeries = cache(async (query: string): Promise<CatalogSeries | null> => {
    const catalog = await getCatalog();
    return catalog.find((series) => series.key === query || String(series.id) === query) ?? null;
});

export const isLocalSeriesId = (id: number) => id >= LOCAL_ID_OFFSET;
