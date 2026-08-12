import WatchClient from "./WatchClient";
import { resolveCatalogSeries } from "@/lib/catalog/catalog";
import { getSeriesResume } from "@/lib/progress/continueWatching";
import { getSeriesProgressAction } from "@/lib/progress/getProgressAction";
import { playbackSourceFromAsset, resolvePlaybackSource } from "@/lib/player/videoAccess";
import { getDemoAsset } from "@/lib/access/demoAsset";
import { getEpisodeChapters } from "@/lib/chapters/chapters";
import { demoChapters } from "@/lib/chapters/demoChapters";
import { DEFAULT_PROFILE_SETTINGS, getSettings } from "@/lib/settings/settings";
import { notFound } from "next/navigation";
import { DataErrorState } from "@/components/data/DataState";

const RESUME_REWIND_SECONDS = 5;

const ErrorScreen = ({ message }: { message: string }) => (
    <div className="fixed inset-0 z-[999] bg-black min-h-screen flex items-center justify-center text-foreground">
        {message}
    </div>
);

const DataErrorScreen = ({ reason }: { reason: Parameters<typeof DataErrorState>[0]["reason"] }) => (
    <div className="fixed inset-0 z-[999] flex min-h-screen items-center justify-center bg-black p-4">
        <DataErrorState reason={reason} headingLevel={1} />
    </div>
);

const WatchPage = async ({ searchParams }: { searchParams: Promise<{ id?: string; ep?: string; party?: string }> }) => {
    const { id: seriesQueryId, ep: epQuery, party: partyCode } = await searchParams;

    if (!seriesQueryId) return <ErrorScreen message="Błędny link" />;

    const seriesResult = await resolveCatalogSeries(seriesQueryId);

    if (seriesResult.kind === "error") {
        return <DataErrorScreen reason={seriesResult.reason} />;
    }

    if (!seriesResult.data) notFound();

    const series = seriesResult.data;
    const demo = series.access === "full" ? null : await getDemoAsset();

    if (series.access !== "full" && !demo) {
        return <ErrorScreen message="Brak dostępu do tego materiału" />;
    }

    let episode = null;
    let savedTime = 0;
    let timeResolved = false;

    if (epQuery && epQuery.toLowerCase().endsWith(".mp4")) {
        episode = series.episodes.find((item) => item.key === epQuery) ?? null;

        if (!episode) return <ErrorScreen message={`Nie znaleziono odcinka: ${epQuery}`} />;
    } else if (epQuery) {
        const number = Number(epQuery);
        episode = series.episodes.find((item) => item.number === number) ?? null;

        if (!episode) return <ErrorScreen message={`Nie znaleziono odcinka nr ${epQuery}`} />;
    } else {
        const resumeResult = await getSeriesResume(series.key);

        if (resumeResult.kind === "error") {
            return <DataErrorScreen reason={resumeResult.reason} />;
        }

        const resume = resumeResult.data;
        episode = series.episodes.find((item) => item.key === resume?.episodeKey) ?? series.episodes[0] ?? null;

        if (resume && episode?.key === resume.episodeKey) {
            savedTime = resume.positionSeconds;
            timeResolved = true;
        }
    }

    if (!episode) return <ErrorScreen message="Nie znaleziono pliku odcinka na serwerze" />;

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
            return <DataErrorScreen reason={progressResult.reason} />;
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

    return (
        <>
            <WatchClient
                playback={playback}
                seriesTitle={series.title}
                episodeTitle={episode.title ?? `Odcinek ${episode.number}`}
                seasonNumber={series.seasonNumber}
                episodeSynopsis={episode.synopsis ?? series.synopsis}
                seriesId={series.id}
                seriesKey={series.key}
                currentEpisode={episode.number}
                totalEpisodes={series.episodeCount}
                fileName={episode.key}
                startTime={startTime}
                nextEpisodeTitle={nextEpisode ? nextEpisode.title ?? `Odcinek ${nextEpisode.number}` : undefined}
                chapters={chapters}
                autoplayNext={settings.autoplayNext}
                skipIntroPrompt={settings.skipIntroPrompt}
                defaultVolume={settings.defaultVolume}
                isDemo={demo !== null}
                partyCode={partyCode}
                episodeKeys={series.episodes.map((item) => ({ key: item.key, number: item.number }))}
                nextEpisodeKey={nextEpisode?.key}
                previousEpisodeKey={series.episodes.find((item) => item.number === episode.number - 1)?.key}
            />
        </>
    );
};

export default WatchPage;
