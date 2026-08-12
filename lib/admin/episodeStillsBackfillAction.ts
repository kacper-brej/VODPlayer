"use server";

import { updateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getTmdbSeasonEpisodes, getTmdbSeasonSummaries } from "@/lib/metadata/providers/tmdb";
import { CATALOG_TAG } from "@/lib/core/vodConfig";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import {
    listEpisodeBackfillSeries,
    saveEpisodeMetadata,
    type EpisodeBackfillSeries,
} from "@/lib/episodes/episodeMetadataService";
import { getSeriesMetadata, saveReviewDecision } from "@/lib/seriesMetadata/seriesMetadataService";

export interface EpisodeStillsResult {
    title: string;
    status: "updated" | "season-ambiguous" | "no-tmdb-mapping" | "no-episodes" | "save-failed" | "lookup-failed";
    matchedEpisodes: number;
    countMismatch: boolean;
}

const fetchTmdbExternalId = async (seriesKey: string): Promise<string | null> => {
    try {
        return (await getSeriesMetadata(seriesKey)).externalIds.tmdb ?? null;
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

const markSeasonAmbiguous = async (seriesKey: string) => {
    try {
        await saveReviewDecision(seriesKey, { state: "pending", reason: "uncertain-season", preserveSkipped: true });
    } catch {
        return;
    }
};

const refreshSeries = async (
    series: EpisodeBackfillSeries,
    forcedSeasonNumber?: number,
): Promise<EpisodeStillsResult> => {
    const tmdbExternalId = await fetchTmdbExternalId(series.key);

    if (!tmdbExternalId) {
        return { title: series.title, status: "no-tmdb-mapping", matchedEpisodes: 0, countMismatch: false };
    }

    const seasonNumber = forcedSeasonNumber ?? await resolveSeasonNumber(series.seasonNumber, tmdbExternalId);

    if (seasonNumber === null) {
        await markSeasonAmbiguous(series.key);
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
        if (tmdbEpisode.stillPath && episode.thumbnailSource !== "local") {
            body.thumbnailPath = tmdbEpisode.stillPath;
            body.thumbnailSource = "tmdb";
        }

        if (Object.keys(body).length <= 2) {
            matched++;
            continue;
        }

        const saved = await saveEpisodeMetadata(body);
        if (saved.ok) matched++;
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
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    try {
        const series = (await listEpisodeBackfillSeries()).find((entry) => entry.key === seriesKey);
        if (!series) return dataFailure("invalid_response", 404);

        const result = await refreshSeries(series, seasonNumber);
        if (result.status === "updated" || result.status === "save-failed") updateTag(CATALOG_TAG);
        return dataSuccess(result);
    } catch (error) {
        console.error("refreshSeriesEpisodeStillsAction failed", error);
        return dataFailure("server");
    }
};

const backfillEpisodeStillsAction = async (): Promise<DataResult<EpisodeStillsResult[]>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    try {
        const results: EpisodeStillsResult[] = [];

        for (const series of await listEpisodeBackfillSeries()) {
            results.push(await refreshSeries(series));
        }

        if (results.some((result) => result.status === "updated" || result.status === "save-failed")) {
            updateTag(CATALOG_TAG);
        }
        return results.length === 0 ? dataEmpty(results) : dataSuccess(results);
    } catch (error) {
        console.error("backfillEpisodeStillsAction failed", error);
        return dataFailure("server");
    }
};

export default backfillEpisodeStillsAction;
