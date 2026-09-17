import "server-only";
import { loadCatalogPayload } from "./catalog";

export const getCatalogEpisodeKeys = async (seriesKey: string): Promise<string[]> => {
    try {
        const payload = await loadCatalogPayload();
        const series = payload.series.find((entry) => entry.key === seriesKey);
        return series?.episodes.map((episode) => episode.key) ?? [];
    } catch (error) {
        console.error("Catalog episode keys request failed:", error);
        return [];
    }
};
