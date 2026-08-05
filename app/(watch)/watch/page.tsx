import WatchClient from "./WatchClient";
import { resolveCatalogSeries } from "@/lib/catalog";
import { getSeriesResume } from "@/lib/continueWatching";
import { getSeriesProgressAction } from "@/lib/getProgressAction";
import { resolvePlaybackSource } from "@/lib/videoAccess";
import { getEpisodeChapters } from "@/lib/chapters";
import { DEFAULT_PROFILE_SETTINGS, getSettings } from "@/lib/settings";
import { notFound } from "next/navigation";
import { DataErrorState } from "@/components/data/DataState";
import PreconnectVideoOrigin from "@/components/layout/PreconnectVideoOrigin";

const RESUME_REWIND_SECONDS = 10;

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

const WatchPage = async ({ searchParams }: { searchParams: Promise<{ id?: string; ep?: string }> }) => {
    const { id: seriesQueryId, ep: epQuery } = await searchParams;

    if (!seriesQueryId) return <ErrorScreen message="Błędny link" />;

    const seriesResult = await resolveCatalogSeries(seriesQueryId);

    if (seriesResult.kind === "error") {
        return <DataErrorScreen reason={seriesResult.reason} />;
    }

    if (!seriesResult.data) notFound();

    const series = seriesResult.data;

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
    const chapters = chaptersResult.kind === "error" ? [] : chaptersResult.data;
    const settingsResult = await settingsPromise;
    const settings = settingsResult.kind === "error" ? DEFAULT_PROFILE_SETTINGS : settingsResult.data;

    const playback = resolvePlaybackSource(series.key, episode);

    return (
        <>
            <PreconnectVideoOrigin />
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
                startTime={Math.max(0, savedTime - RESUME_REWIND_SECONDS)}
                nextEpisodeTitle={nextEpisode ? nextEpisode.title ?? `Odcinek ${nextEpisode.number}` : undefined}
                chapters={chapters}
                autoplayNext={settings.autoplayNext}
                skipIntroPrompt={settings.skipIntroPrompt}
                defaultVolume={settings.defaultVolume}
            />
        </>
    );
};

export default WatchPage;
