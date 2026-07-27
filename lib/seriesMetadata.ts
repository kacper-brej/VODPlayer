import { updateTag } from "next/cache";
import { CATALOG_TAG, VOD_ORIGIN, VOD_SERVICE_KEY } from "@/lib/vodConfig";
import { fetchJikan } from "@/lib/jikanClient";

export interface JikanSeriesMetadata {
    coverImage: string | null;
    bannerImage: string | null;
    synopsis: string | null;
    rating: string | null;
    year: number | null;
}

export const lookupJikanMetadata = async (title: string): Promise<JikanSeriesMetadata | null> => {
    const jikan = await fetchJikan(`/anime?q=${encodeURIComponent(title)}&limit=1`);
    const anime = jikan?.data?.[0];

    if (!anime) return null;

    const image = anime.images?.webp?.large_image_url ?? null;

    return {
        coverImage: image,
        bannerImage: image,
        synopsis: anime.synopsis ?? null,
        rating: anime.score ? String(anime.score) : null,
        year: anime.year ?? null,
    };
};

export const persistSeriesMetadata = async (title: string, entry: JikanSeriesMetadata): Promise<boolean> => {
    try {
        const res = await fetch(`${VOD_ORIGIN}/cache-covers.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ key: VOD_SERVICE_KEY, title, ...entry }),
        });

        return res.ok;
    } catch (error) {
        console.error("metadata persist failed", error);
        return false;
    }
};

export const invalidateCatalogCache = () => {
    updateTag(CATALOG_TAG);
};
