import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import { getVirtualTmdbTitle, parseVirtualTmdbRef } from "@/lib/catalog/tmdbVirtualSeries";
import { mapWithConcurrency } from "@/lib/core/mapWithConcurrency";

export const resolveSavedCatalogSeries = async (
    catalog: readonly CatalogSeries[],
    seriesKeys: readonly string[],
    resolveVirtual = getVirtualTmdbTitle,
): Promise<{ series: CatalogSeries[]; unavailableKeys: string[] }> => {
    const byKey = new Map(catalog.map((series) => [series.key, series]));
    const keys = [...new Set(seriesKeys)];
    const resolved = await mapWithConcurrency(keys, 3, async (key) => {
        const local = byKey.get(key);
        if (local) return local;
        const ref = parseVirtualTmdbRef(key);
        if (!ref) return null;
        try {
            const result = await resolveVirtual(ref);
            return result.kind === "error" ? null : result.data;
        } catch {
            return null;
        }
    });
    return {
        series: resolved.filter((series): series is CatalogSeries => series !== null),
        unavailableKeys: keys.filter((_, index) => resolved[index] === null),
    };
};
