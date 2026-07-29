"use server";
import { getCatalog } from "@/lib/catalog";
import { lookupJikanMetadata, persistSeriesMetadata, invalidateCatalogCache } from "@/lib/seriesMetadata";
import { dataEmpty, dataSuccess, type DataResult } from "@/lib/dataResult";

export interface BackfillResult {
    title: string;
    status: "saved" | "not-found" | "save-failed" | "lookup-failed";
}

const backfillCatalogMetadataAction = async (): Promise<DataResult<BackfillResult[]>> => {
    const catalogResult = await getCatalog();
    if (catalogResult.kind === "error") return catalogResult;

    const pending = catalogResult.data.filter((series) =>
        !series.hasMetadata || series.genres.length === 0 || series.studio === null
    );
    const results: BackfillResult[] = [];

    for (const series of pending) {
        const metadataResult = await lookupJikanMetadata(series.title);

        if (metadataResult.kind === "error") {
            results.push({ title: series.title, status: "lookup-failed" });
            continue;
        }

        if (!metadataResult.data) {
            results.push({ title: series.title, status: "not-found" });
            continue;
        }

        const saved = await persistSeriesMetadata(series.title, metadataResult.data);
        results.push({ title: series.title, status: saved ? "saved" : "save-failed" });
    }

    if (results.some((result) => result.status === "saved")) {
        invalidateCatalogCache();
    }

    return results.length === 0
        ? dataEmpty(results)
        : dataSuccess(results);
};

export default backfillCatalogMetadataAction;
