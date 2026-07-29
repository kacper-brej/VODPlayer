import { updateTag } from "next/cache";
import { CATALOG_TAG, VOD_ORIGIN, VOD_SERVICE_KEY } from "@/lib/vodConfig";
import { fetchJikanResult } from "@/lib/jikanClient";
import { validateJikanAnimeListResponse } from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/dataResult";

export interface JikanSeriesMetadata {
    coverImage: string | null;
    backdropImage: string | null;
    synopsis: string | null;
    rating: string | null;
    ageRating: string | null;
    year: number | null;
    genres: string[];
    studio: string | null;
}

const mapAgeRating = (classification: string | null): string | null => {
    if (!classification) return null;
    if (classification.startsWith("G")) return "7+";
    if (classification.startsWith("PG-13")) return "12+";
    if (classification.startsWith("PG")) return "7+";
    if (classification.startsWith("R - 17")) return "16+";
    if (classification.startsWith("R+")) return "18+";
    return null;
};

export const lookupJikanMetadata = async (
    title: string,
): Promise<DataResult<JikanSeriesMetadata | null>> => {
    const response = await fetchJikanResult(`/anime?q=${encodeURIComponent(title)}&limit=1`);
    if (response.kind === "error") return response;

    const result = validateJikanAnimeListResponse(response.data);
    if (!result.ok) return dataFailure("invalid_response");

    const anime = result.data.data[0];
    if (!anime) return dataEmpty(null);

    if (anime.rating?.startsWith("Rx")) return dataEmpty(null);

    return dataSuccess({
        coverImage: anime.images.webp.large_image_url,
        backdropImage: anime.trailer?.images?.maximum_image_url ?? null,
        synopsis: anime.synopsis ?? null,
        rating: anime.score ? String(anime.score) : null,
        ageRating: mapAgeRating(anime.rating),
        year: anime.year ?? null,
        genres: (anime.genres ?? []).map((genre) => genre.name.trim()).filter((name) => name !== ""),
        studio: anime.studios?.[0]?.name.trim() || null,
    });
};

export const persistSeriesMetadata = async (title: string, entry: JikanSeriesMetadata): Promise<boolean> => {
    try {
        const res = await fetch(`${VOD_ORIGIN}/cache-covers.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
                key: VOD_SERVICE_KEY,
                title,
                ...entry,
                backdropSource: entry.backdropImage ? "jikan" : null,
            }),
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
