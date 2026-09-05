import "server-only";
import { resolveCatalogSeries } from "@/lib/catalog/catalog";
import {
    getVirtualTmdbEpisodes,
    isVirtualTmdbTvKey,
    parseVirtualEpisodeKey,
} from "@/lib/catalog/tmdbVirtualSeries";
import { getSeriesResume } from "@/lib/progress/continueWatching";
import { getSeriesProgressAction } from "@/lib/progress/getProgressAction";
import { playbackSourceFromAsset, resolvePlaybackSource } from "@/lib/player/videoAccess";
import { getDemoAsset } from "@/lib/access/demoAsset";
import { getEpisodeChapters } from "@/lib/chapters/chapters";
import { demoChapters } from "@/lib/chapters/demoChapters";
import { DEFAULT_PROFILE_SETTINGS, getSettings } from "@/lib/settings/settings";
import type { WatchData } from "./watchData";
import type { DataErrorReason } from "@/lib/core/dataResult";

const RESUME_REWIND_SECONDS = 5;

export type WatchDataResult =
    | { kind: "success"; data: WatchData }
    | { kind: "not-found" }
    | { kind: "error"; message: string; status: number }
    | { kind: "data-error"; reason: DataErrorReason };

export const resolveWatchData = async (seriesQueryId?: string, epQuery?: string, partyCode?: string): Promise<WatchDataResult> => {
    if (!seriesQueryId) return { kind: "error", message: "Błędny link", status: 400 };

    const seriesResult = await resolveCatalogSeries(seriesQueryId);

    if (seriesResult.kind === "error") {
        return { kind: "data-error", reason: seriesResult.reason };
    }

    if (!seriesResult.data) return { kind: "not-found" };

    const resolved = seriesResult.data;
    const requestedVirtualEpisode = epQuery ? parseVirtualEpisodeKey(epQuery) : null;
    const virtualTmdbId = isVirtualTmdbTvKey(resolved.key) ? resolved.tmdbExternalId : null;

    const series = requestedVirtualEpisode && virtualTmdbId !== null
        && requestedVirtualEpisode.season !== resolved.seasonNumber
        ? await (async () => {
            const episodes = await getVirtualTmdbEpisodes(virtualTmdbId, requestedVirtualEpisode.season);
            return episodes.length === 0
                ? resolved
                : { ...resolved, episodes, seasonNumber: requestedVirtualEpisode.season, episodeCount: episodes.length };
        })()
        : resolved;

    const demo = series.access === "full" ? null : await getDemoAsset();

    if (series.access !== "full" && !demo) {
        return { kind: "error", message: "Brak dostępu do tego materiału", status: 403 };
    }

    let episode = null;
    let savedTime = 0;
    let timeResolved = false;

    if (epQuery && (epQuery.toLowerCase().endsWith(".mp4") || requestedVirtualEpisode)) {
        episode = series.episodes.find((item) => item.key === epQuery) ?? null;

        if (!episode) return { kind: "error", message: `Nie znaleziono odcinka: ${epQuery}`, status: 404 };
    } else if (epQuery) {
        const number = Number(epQuery);
        episode = series.episodes.find((item) => item.number === number) ?? null;

        if (!episode) return { kind: "error", message: `Nie znaleziono odcinka nr ${epQuery}`, status: 404 };
    } else {
        const resumeResult = await getSeriesResume(series.key);

        if (resumeResult.kind === "error") {
            return { kind: "data-error", reason: resumeResult.reason };
        }

        const resume = resumeResult.data;
        episode = series.episodes.find((item) => item.key === resume?.episodeKey) ?? series.episodes[0] ?? null;

        if (resume && episode?.key === resume.episodeKey) {
            savedTime = resume.positionSeconds;
            timeResolved = true;
        }
    }

    if (!episode) return { kind: "error", message: "Nie znaleziono pliku odcinka na serwerze", status: 404 };

    const chaptersPromise = getEpisodeChapters(series.key, episode.key);
    const settingsPromise = getSettings();
    let chaptersResult;

    if (!timeResolved) {
        const [progressResult, resolvedChapters] = await Promise.all([
            getSeriesProgressAction(series.key),
            chaptersPromise,
        ]);
        chaptersResult = resolvedChapters;

        if (progressResult.kind === "error") {
            return { kind: "data-error", reason: progressResult.reason };
        }

        savedTime = progressResult.data.episodes[episode.key]?.positionSeconds ?? 0;
    } else {
        chaptersResult = await chaptersPromise;
    }

    const nextEpisode = series.episodes.find((item) => item.number === episode.number + 1) ?? null;
    const settingsResult = await settingsPromise;
    const settings = settingsResult.kind === "error" ? DEFAULT_PROFILE_SETTINGS : settingsResult.data;

    const resolvedChapters = chaptersResult.kind === "error" ? [] : chaptersResult.data;
    const chapters = demo ? demoChapters(demo.durationSeconds) : resolvedChapters;

    const playback = demo
        ? playbackSourceFromAsset(demo.assetId, demo.assetVersion, demo.seriesKey, demo.episodeKey, demo.heights)
        : resolvePlaybackSource(series.key, episode);

    const rewoundTime = Math.max(0, savedTime - RESUME_REWIND_SECONDS);
    const startTime = demo?.durationSeconds && rewoundTime >= demo.durationSeconds ? 0 : rewoundTime;

    return {
        kind: "success",
        data: {
            playback,
            seriesTitle: series.title,
            episodeTitle: episode.title ?? `Odcinek ${episode.number}`,
            seasonNumber: series.seasonNumber,
            episodeSynopsis: episode.synopsis ?? series.synopsis,
            seriesId: series.id,
            seriesKey: series.key,
            currentEpisode: episode.number,
            totalEpisodes: series.episodeCount,
            fileName: episode.key,
            startTime,
            nextEpisodeTitle: nextEpisode ? nextEpisode.title ?? `Odcinek ${nextEpisode.number}` : undefined,
            chapters,
            autoplayNext: settings.autoplayNext,
            skipIntroPrompt: settings.skipIntroPrompt,
            defaultVolume: settings.defaultVolume,
            isDemo: demo !== null,
            partyCode,
            episodeKeys: series.episodes.map((item) => ({ key: item.key, number: item.number })),
            nextEpisodeKey: nextEpisode?.key,
            previousEpisodeKey: series.episodes.find((item) => item.number === episode.number - 1)?.key,
        },
    };
};
