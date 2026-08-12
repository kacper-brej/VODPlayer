import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/core/vodConfig";
import { saveCoverMetadata } from "@/lib/seriesMetadata/coverMetadataService";
import type { ProviderArtwork, ProviderId, ProviderSeries } from "@/lib/metadata/types";

export interface DescriptiveMetadata {
    metadataProvider?: "jikan";
    externalId?: number;
    coverImage: string | null;
    backdropImage: string | null;
    synopsis: string | null;
    rating: string | null;
    ageRating: string | null;
    year: number | null;
    genres: string[];
    studio: string | null;
}

export const toLegacyMetadata = (
    providerId: ProviderId,
    externalId: string,
    series: ProviderSeries,
    artwork: ProviderArtwork[],
): DescriptiveMetadata => {
    const isJikan = providerId === "jikan";

    return {
        ...(isJikan ? { metadataProvider: "jikan" as const, externalId: Number(externalId) } : {}),
        coverImage: isJikan ? artwork.find((entry) => entry.kind === "poster")?.url ?? null : null,
        backdropImage: isJikan ? artwork.find((entry) => entry.kind === "backdrop")?.url ?? null : null,
        synopsis: series.synopsis,
        rating: series.score !== null ? String(series.score) : null,
        ageRating: series.ageRating,
        year: series.year,
        genres: series.genres,
        studio: series.studio,
    };
};

export const persistSeriesMetadata = async (title: string, entry: DescriptiveMetadata): Promise<boolean> => {
    try {
        await saveCoverMetadata({
            title,
            ...entry,
            backdropSource: entry.backdropImage ? "jikan" : null,
            studio: entry.studio,
            genres: entry.genres,
        });
        return true;
    } catch (error) {
        console.error("metadata persist failed", error);
        return false;
    }
};

export const invalidateCatalogCache = () => {
    revalidateTag(CATALOG_TAG, "max");
};
