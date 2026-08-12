"use server";
import { getCatalog, type CatalogSeries } from "@/lib/catalog/catalog";
import { getProvider } from "@/lib/metadata/registry";
import { findConfidentMatch } from "@/lib/metadata/identityMatch";
import { buildArtworkPayload } from "@/lib/metadata/persistIdentity";
import type { MetadataProvider, ProviderArtwork, ProviderSeries, SeriesCandidate } from "@/lib/metadata/types";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { getSessionUser } from "@/lib/auth/session";
import { saveCoverMetadata } from "@/lib/seriesMetadata/coverMetadataService";
import { getSeriesMetadata, saveArtworkCandidates, saveExternalId, saveReviewDecision } from "@/lib/seriesMetadata/seriesMetadataService";

export interface TmdbEnrichmentResult {
    title: string;
    status: "enriched" | "ambiguous" | "not-found" | "save-failed" | "lookup-failed";
}

const markTmdbReview = async (seriesKey: string, pending: boolean) => {
    await saveReviewDecision(seriesKey, {
        state: "pending", reason: pending ? "missing-tmdb" : null, preserveSkipped: true,
    });
};

const fetchSeriesMetadata = async (seriesKey: string) => {
    try {
        return await getSeriesMetadata(seriesKey);
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
    const genres = series.genres.length === 0 && tmdbSeries.genres.length > 0 ? tmdbSeries.genres : undefined;
    const hasGap = tmdbSeries.ageRating !== null || (!series.synopsis && tmdbSeries.synopsis)
        || genres !== undefined || (!series.studio && tmdbSeries.studio) || (series.year === null && tmdbSeries.year !== null);
    if (!hasGap) return true;

    try {
        await saveCoverMetadata({
            title: seriesKey, coverImage: null, backdropImage: null, backdropSource: null,
            synopsis: !series.synopsis ? tmdbSeries.synopsis : null,
            rating: null, ageRating: tmdbSeries.ageRating,
            year: series.year === null ? tmdbSeries.year : null,
            studio: !series.studio ? tmdbSeries.studio : null,
            genres,
        });
        return true;
    } catch (error) {
        console.error("tmdb descriptive gap-fill persist failed", error);
        return false;
    }
};

const persistTmdbEnrichment = async (
    series: CatalogSeries,
    tmdbSeries: ProviderSeries,
    artwork: ProviderArtwork[],
): Promise<boolean> => {
    const artworkItems = buildArtworkPayload("tmdb", artwork);
    const artworkSaved = artworkItems.length === 0
        ? true
        : await saveArtworkCandidates(series.key, artworkItems.map((item) => ({ ...item, dominantColor: null, placeholder: null })))
            .then(() => true, () => false);

    const descriptiveSaved = await persistDescriptiveGapFill(series.key, series, tmdbSeries);

    return artworkSaved && descriptiveSaved;
};

const backfillTmdbArtworkAction = async (): Promise<DataResult<TmdbEnrichmentResult[]>> => {
    const catalogResult = await getCatalog();
    if (catalogResult.kind === "error") return catalogResult;

    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    const tmdb = getProvider("tmdb");
    if (!tmdb || !tmdb.getArtwork) return dataFailure("server");

    const results: TmdbEnrichmentResult[] = [];

    for (const series of catalogResult.data) {
        const lookup = await fetchSeriesMetadata(series.key);

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
                await markTmdbReview(series.key, true);
                results.push({ title: series.title, status: "not-found" });
                continue;
            }

            if (matchResult.data.kind === "ambiguous") {
                await markTmdbReview(series.key, true);
                results.push({ title: series.title, status: "ambiguous" });
                continue;
            }

            tmdbExternalId = matchResult.data.candidate.externalId;

            const savedId = await saveExternalId(series.key, {
                provider: "tmdb", externalId: tmdbExternalId, matchSource: "auto",
            }).then(() => true, () => false);

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

        const saved = await persistTmdbEnrichment(series, seriesResult.data, artworkResult.data);
        if (saved) await markTmdbReview(series.key, false);
        results.push({ title: series.title, status: saved ? "enriched" : "save-failed" });
    }

    return results.length === 0 ? dataEmpty(results) : dataSuccess(results);
};

export default backfillTmdbArtworkAction;
