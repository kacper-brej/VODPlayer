"use server";
import { getCatalog, type CatalogSeries } from "@/lib/catalog";
import { getTmdbSeasonEpisodes, getTmdbSeasonSummaries } from "@/lib/metadata/providers/tmdb";
import { validateSeriesMetadataLookupResponse } from "@/lib/contracts";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/dataResult";

export interface EpisodeStillsResult {
    title: string;
    status: "updated" | "season-ambiguous" | "no-tmdb-mapping" | "no-episodes" | "save-failed" | "lookup-failed";
    matchedEpisodes: number;
    countMismatch: boolean;
}

const fetchTmdbExternalId = async (
    headers: Record<string, string>,
    seriesKey: string,
): Promise<string | null> => {
    try {
        const res = await fetch(`${VOD_ORIGIN}/series-metadata.php?seriesKey=${encodeURIComponent(seriesKey)}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) return null;

        const payload: unknown = await res.json();
        const result = validateSeriesMetadataLookupResponse(payload);

        return result.ok ? result.data.externalIds.tmdb ?? null : null;
    } catch (error) {
        console.error("series-metadata lookup failed", error);
        return null;
    }
};

const resolveSeasonNumber = async (
    seasonNumberFromGrouping: number | null,
    tmdbExternalId: string,
): Promise<number | null> => {
    if (seasonNumberFromGrouping !== null) return seasonNumberFromGrouping;

    const summaries = await getTmdbSeasonSummaries(tmdbExternalId);
    if (summaries.kind === "error") return null;

    const realSeasons = summaries.data.filter((season) => season.season_number !== 0);
    return realSeasons.length === 1 ? realSeasons[0].season_number : null;
};

const postEpisodeMetadata = async (
    headers: Record<string, string>,
    body: Record<string, unknown>,
): Promise<boolean> => {
    try {
        const res = await fetch(`${VOD_ORIGIN}/episode-metadata.php`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(body),
        });

        if (!res.ok) return false;

        const payload: unknown = await res.json().catch(() => null);
        return Boolean(payload) && typeof payload === "object" && (payload as { success?: unknown }).success === true;
    } catch (error) {
        console.error("episode-metadata persist failed", error);
        return false;
    }
};

const markSeasonAmbiguous = async (headers: Record<string, string>, seriesKey: string) => {
    try {
        await fetch(`${VOD_ORIGIN}/series-metadata.php`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
                seriesKey,
                reviewDecision: { state: "pending", reason: "uncertain-season", preserveSkipped: true },
            }),
        });
    } catch {
        return;
    }
};

const refreshSeries = async (
    series: CatalogSeries,
    headers: Record<string, string>,
    forcedSeasonNumber?: number,
): Promise<EpisodeStillsResult> => {
    const tmdbExternalId = await fetchTmdbExternalId(headers, series.key);

    if (!tmdbExternalId) {
        return { title: series.title, status: "no-tmdb-mapping", matchedEpisodes: 0, countMismatch: false };
    }

    const seasonNumber = forcedSeasonNumber ?? await resolveSeasonNumber(series.seasonNumber, tmdbExternalId);

    if (seasonNumber === null) {
        await markSeasonAmbiguous(headers, series.key);
        return { title: series.title, status: "season-ambiguous", matchedEpisodes: 0, countMismatch: false };
    }

    const seasonResult = await getTmdbSeasonEpisodes(tmdbExternalId, seasonNumber);

    if (seasonResult.kind === "error") {
        return { title: series.title, status: "lookup-failed", matchedEpisodes: 0, countMismatch: false };
    }

    if (seasonResult.data.length === 0) {
        return { title: series.title, status: "no-episodes", matchedEpisodes: 0, countMismatch: false };
    }

    const tmdbByNumber = new Map(seasonResult.data.map((episode) => [episode.number, episode]));
    const countMismatch = series.episodes.length !== seasonResult.data.length;
    let matched = 0;
    let allSaved = true;

    for (const episode of series.episodes) {
        const tmdbEpisode = tmdbByNumber.get(episode.number);
        if (!tmdbEpisode) continue;

        const body: Record<string, unknown> = { series: series.key, episode: episode.key };
        if (episode.title === null && tmdbEpisode.title) body.title = tmdbEpisode.title;
        if (episode.synopsis === null && tmdbEpisode.synopsis) body.synopsis = tmdbEpisode.synopsis;
        if (tmdbEpisode.stillPath) {
            body.thumbnailPath = tmdbEpisode.stillPath;
            body.thumbnailSource = "tmdb";
        }

        if (Object.keys(body).length <= 2) {
            matched++;
            continue;
        }

        const saved = await postEpisodeMetadata(headers, body);
        if (saved) matched++;
        else allSaved = false;
    }

    return {
        title: series.title,
        status: allSaved ? "updated" : "save-failed",
        matchedEpisodes: matched,
        countMismatch,
    };
};

export const refreshSeriesEpisodeStillsAction = async (
    seriesKey: string,
    seasonNumber?: number,
): Promise<DataResult<EpisodeStillsResult>> => {
    const catalogResult = await getCatalog();
    if (catalogResult.kind === "error") return catalogResult;

    const headers = await sessionHeaders();
    if (!headers) return dataFailure("unauthorized", 401);

    const series = catalogResult.data.find((entry) => entry.key === seriesKey);
    if (!series) return dataFailure("server", 404);

    return dataSuccess(await refreshSeries(series, headers, seasonNumber));
};

const backfillEpisodeStillsAction = async (): Promise<DataResult<EpisodeStillsResult[]>> => {
    const catalogResult = await getCatalog();
    if (catalogResult.kind === "error") return catalogResult;

    const headers = await sessionHeaders();
    if (!headers) return dataFailure("unauthorized", 401);

    const results: EpisodeStillsResult[] = [];

    for (const series of catalogResult.data) results.push(await refreshSeries(series, headers));

    return results.length === 0 ? dataEmpty(results) : dataSuccess(results);
};

export default backfillEpisodeStillsAction;
