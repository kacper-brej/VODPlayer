"use server";
import { getCatalog, type CatalogSeries } from "@/lib/catalog";
import { getProvider } from "@/lib/metadata/registry";
import { findConfidentMatch } from "@/lib/metadata/identityMatch";
import { buildArtworkPayload, postSeriesMetadata } from "@/lib/metadata/persistIdentity";
import type { MetadataProvider, ProviderArtwork, ProviderSeries, SeriesCandidate } from "@/lib/metadata/types";
import { validateSeriesMetadataLookupResponse } from "@/lib/contracts";
import { VOD_ORIGIN, VOD_SERVICE_KEY, sessionHeaders } from "@/lib/vodConfig";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/dataResult";

export interface TmdbEnrichmentResult {
    title: string;
    status: "enriched" | "ambiguous" | "not-found" | "save-failed" | "lookup-failed";
}

const markTmdbReview = async (headers: Record<string, string>, seriesKey: string, pending: boolean) => {
    await postSeriesMetadata(headers, {
        seriesKey,
        reviewDecision: { state: "pending", reason: pending ? "missing-tmdb" : null, preserveSkipped: true },
    });
};

const fetchSeriesMetadata = async (
    headers: Record<string, string>,
    seriesKey: string,
): Promise<{ externalIds: Record<string, string>; titles: { title: string; kind: string }[] } | null> => {
    try {
        const res = await fetch(`${VOD_ORIGIN}/series-metadata.php?seriesKey=${encodeURIComponent(seriesKey)}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) return null;

        const payload: unknown = await res.json();
        const result = validateSeriesMetadataLookupResponse(payload);

        return result.ok ? { externalIds: result.data.externalIds, titles: result.data.titles } : null;
    } catch (error) {
        console.error("series-metadata lookup failed", error);
        return null;
    }
};

type TmdbMatch =
    | { kind: "matched"; candidate: SeriesCandidate }
    | { kind: "ambiguous" }
    | { kind: "not-found" };

const matchTmdbCandidate = async (
    tmdb: MetadataProvider,
    searchTitles: string[],
    year: number | null,
): Promise<DataResult<TmdbMatch>> => {
    const seen = new Map<string, SeriesCandidate>();

    for (const title of searchTitles) {
        const result = await tmdb.searchSeries(title);
        if (result.kind === "error") return result;
        for (const candidate of result.data) seen.set(candidate.externalId, candidate);
    }

    const candidates = Array.from(seen.values());
    if (candidates.length === 0) return dataEmpty({ kind: "not-found" });

    const titleMatches = searchTitles
        .map((title) => findConfidentMatch(title, candidates))
        .filter((candidate): candidate is SeriesCandidate => candidate !== null);

    const strongMatch = titleMatches.find((candidate) =>
        year === null || candidate.year === null || Math.abs(candidate.year - year) <= 1,
    );

    return strongMatch
        ? dataSuccess({ kind: "matched", candidate: strongMatch })
        : dataSuccess({ kind: "ambiguous" });
};

const persistDescriptiveGapFill = async (
    seriesKey: string,
    series: CatalogSeries,
    tmdbSeries: ProviderSeries,
): Promise<boolean> => {
    const fields: Record<string, unknown> = {};

    if (tmdbSeries.ageRating !== null) fields.ageRating = tmdbSeries.ageRating;
    if (!series.synopsis && tmdbSeries.synopsis) fields.synopsis = tmdbSeries.synopsis;
    if (series.genres.length === 0 && tmdbSeries.genres.length > 0) fields.genres = tmdbSeries.genres;
    if (!series.studio && tmdbSeries.studio) fields.studio = tmdbSeries.studio;
    if (series.year === null && tmdbSeries.year !== null) fields.year = tmdbSeries.year;

    if (Object.keys(fields).length === 0) return true;

    try {
        const res = await fetch(`${VOD_ORIGIN}/cache-covers.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ key: VOD_SERVICE_KEY, title: seriesKey, ...fields }),
        });

        if (!res.ok) return false;

        const payload: unknown = await res.json().catch(() => null);
        return Boolean(payload) && typeof payload === "object" && (payload as { success?: unknown }).success === true;
    } catch (error) {
        console.error("tmdb descriptive gap-fill persist failed", error);
        return false;
    }
};

const persistTmdbEnrichment = async (
    headers: Record<string, string>,
    series: CatalogSeries,
    tmdbSeries: ProviderSeries,
    artwork: ProviderArtwork[],
): Promise<boolean> => {
    const artworkItems = buildArtworkPayload("tmdb", artwork);
    const artworkSaved = artworkItems.length === 0
        ? true
        : await postSeriesMetadata(headers, { seriesKey: series.key, artwork: artworkItems });

    const descriptiveSaved = await persistDescriptiveGapFill(series.key, series, tmdbSeries);

    return artworkSaved && descriptiveSaved;
};

const backfillTmdbArtworkAction = async (): Promise<DataResult<TmdbEnrichmentResult[]>> => {
    const catalogResult = await getCatalog();
    if (catalogResult.kind === "error") return catalogResult;

    const headers = await sessionHeaders();
    if (!headers) return dataFailure("unauthorized", 401);

    const tmdb = getProvider("tmdb");
    if (!tmdb || !tmdb.getArtwork) return dataFailure("server");

    const results: TmdbEnrichmentResult[] = [];

    for (const series of catalogResult.data) {
        const lookup = await fetchSeriesMetadata(headers, series.key);

        if (!lookup) {
            results.push({ title: series.title, status: "lookup-failed" });
            continue;
        }

        let tmdbExternalId = lookup.externalIds.tmdb ?? null;

        if (!tmdbExternalId) {
            const searchTitles = Array.from(new Set([
                ...lookup.titles.filter((entry) => entry.kind === "romaji" || entry.kind === "english").map((entry) => entry.title),
                series.title,
            ]));

            const matchResult = await matchTmdbCandidate(tmdb, searchTitles, series.year);

            if (matchResult.kind === "error") {
                results.push({ title: series.title, status: "lookup-failed" });
                continue;
            }

            if (matchResult.data.kind === "not-found") {
                await markTmdbReview(headers, series.key, true);
                results.push({ title: series.title, status: "not-found" });
                continue;
            }

            if (matchResult.data.kind === "ambiguous") {
                await markTmdbReview(headers, series.key, true);
                results.push({ title: series.title, status: "ambiguous" });
                continue;
            }

            tmdbExternalId = matchResult.data.candidate.externalId;

            const savedId = await postSeriesMetadata(headers, {
                seriesKey: series.key,
                provider: "tmdb",
                externalId: tmdbExternalId,
                matchSource: "auto",
            });

            if (!savedId) {
                results.push({ title: series.title, status: "save-failed" });
                continue;
            }
        }

        const [seriesResult, artworkResult] = await Promise.all([
            tmdb.getSeries(tmdbExternalId),
            tmdb.getArtwork(tmdbExternalId),
        ]);

        if (seriesResult.kind === "error" || artworkResult.kind === "error") {
            results.push({ title: series.title, status: "lookup-failed" });
            continue;
        }

        const saved = await persistTmdbEnrichment(headers, series, seriesResult.data, artworkResult.data);
        if (saved) await markTmdbReview(headers, series.key, false);
        results.push({ title: series.title, status: saved ? "enriched" : "save-failed" });
    }

    return results.length === 0 ? dataEmpty(results) : dataSuccess(results);
};

export default backfillTmdbArtworkAction;
