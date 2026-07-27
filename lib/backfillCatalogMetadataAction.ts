"use server";
import { getCatalog } from "@/lib/catalog";
import { lookupJikanMetadata, persistSeriesMetadata, invalidateCatalogCache } from "@/lib/seriesMetadata";

export interface BackfillResult {
    title: string;
    status: "saved" | "not-found" | "save-failed";
}

const backfillCatalogMetadataAction = async (): Promise<BackfillResult[]> => {
    const catalog = await getCatalog();
    const pending = catalog.filter((series) => !series.hasMetadata);
    const results: BackfillResult[] = [];

    for (const series of pending) {
        const metadata = await lookupJikanMetadata(series.title);

        if (!metadata) {
            results.push({ title: series.title, status: "not-found" });
            continue;
        }

        const saved = await persistSeriesMetadata(series.title, metadata);
        results.push({ title: series.title, status: saved ? "saved" : "save-failed" });
    }

    if (results.some((result) => result.status === "saved")) {
        invalidateCatalogCache();
    }

    return results;
};

export default backfillCatalogMetadataAction;
