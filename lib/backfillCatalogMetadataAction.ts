"use server";
import { getCatalog } from "@/lib/catalog";
import { resolveSeriesIdentity } from "@/lib/metadata/registry";
import { persistSeriesIdentity } from "@/lib/metadata/persistIdentity";
import { invalidateCatalogCache } from "@/lib/seriesMetadata";
import { dataEmpty, dataSuccess, type DataResult } from "@/lib/dataResult";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";

export interface BackfillResult {
    title: string;
    status: "saved" | "ambiguous" | "not-found" | "save-failed" | "lookup-failed";
}

const markReview = async (seriesKey: string, reason: "no-match" | "partial-match" | null) => {
    const headers = await sessionHeaders();
    if (!headers) return;
    try {
        await fetch(`${VOD_ORIGIN}/series-metadata.php`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ seriesKey, reviewDecision: { state: "pending", reason, preserveSkipped: true } }),
        });
    } catch {
        return;
    }
};

const backfillCatalogMetadataAction = async (): Promise<DataResult<BackfillResult[]>> => {
    const catalogResult = await getCatalog();
    if (catalogResult.kind === "error") return catalogResult;

    const pending = catalogResult.data.filter((series) =>
        !series.hasMetadata || series.genres.length === 0 || series.studio === null || series.posterImage === null
    );
    const results: BackfillResult[] = [];

    for (const series of pending) {
        const identityResult = await resolveSeriesIdentity(series.title);

        if (identityResult.kind === "error") {
            results.push({ title: series.title, status: "lookup-failed" });
            continue;
        }

        const identity = identityResult.data;

        if (identity.kind === "not-found") {
            await markReview(series.key, "no-match");
            results.push({ title: series.title, status: "not-found" });
            continue;
        }

        if (identity.kind === "ambiguous") {
            await markReview(series.key, "partial-match");
            results.push({ title: series.title, status: "ambiguous" });
            continue;
        }

        const saved = await persistSeriesIdentity(
            series.key,
            identity.providerId,
            identity.externalId,
            identity.series,
            identity.artwork,
            "auto",
        );
        if (saved) await markReview(series.key, null);
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
