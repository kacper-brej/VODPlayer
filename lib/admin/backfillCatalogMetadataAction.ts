"use server";
import { getCatalog } from "@/lib/catalog/catalog";
import { resolveSeriesIdentity } from "@/lib/metadata/registry";
import { persistSeriesIdentity } from "@/lib/metadata/persistIdentity";
import { invalidateCatalogCache } from "@/lib/catalog/seriesMetadata";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { saveReviewDecision } from "@/lib/seriesMetadata/seriesMetadataService";
import { getSessionUser } from "@/lib/auth/session";

export interface BackfillResult {
    title: string;
    status: "saved" | "ambiguous" | "not-found" | "save-failed" | "lookup-failed";
}

const markReview = async (seriesKey: string, reason: "no-match" | "partial-match" | null) => {
    try {
        await saveReviewDecision(seriesKey, { state: "pending", reason, preserveSkipped: true });
    } catch {
        return;
    }
};

const backfillCatalogMetadataAction = async (): Promise<DataResult<BackfillResult[]>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

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
