import WatchClient from "@/app/watch/WatchClient";
import { resolveCatalogSeries } from "@/lib/catalog";
import { getSeriesResume } from "@/lib/continueWatching";
import { getSeriesProgressAction } from "@/lib/getProgressAction";

const RESUME_REWIND_SECONDS = 10;

const buildEpisodeTitle = (seriesTitle: string, episodeKey: string, episodeNumber: number) => {
    const label = episodeKey.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

    if (!label || /^\d+$/.test(label)) return `${seriesTitle} - Odcinek ${episodeNumber}`;

    return label;
};

const ErrorScreen = ({ message }: { message: string }) => (
    <div className="fixed inset-0 z-[999] bg-black min-h-screen flex items-center justify-center text-foreground">
        {message}
    </div>
);

const WatchPage = async ({ searchParams }: { searchParams: Promise<{ id?: string; ep?: string }> }) => {
    const { id: seriesQueryId, ep: epQuery } = await searchParams;

    if (!seriesQueryId) return <ErrorScreen message="Błędny link" />;

    const series = await resolveCatalogSeries(seriesQueryId);

    if (!series) return <ErrorScreen message={`Nie znaleziono serialu: ${seriesQueryId}`} />;

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
        const resume = await getSeriesResume(series.key);
        episode = series.episodes.find((item) => item.key === resume?.episodeKey) ?? series.episodes[0] ?? null;

        if (resume && episode?.key === resume.episodeKey) {
            savedTime = resume.positionSeconds;
            timeResolved = true;
        }
    }

    if (!episode) return <ErrorScreen message="Nie znaleziono pliku odcinka na serwerze" />;

    if (!timeResolved) {
        const { episodes } = await getSeriesProgressAction(series.key);
        savedTime = episodes[episode.key]?.positionSeconds ?? 0;
    }

    const nextEpisode = series.episodes.find((item) => item.number === episode.number + 1) ?? null;

    return (
        <WatchClient
            videoSrc={episode.url}
            title={`${series.title} - Odcinek ${episode.number}`}
            seriesId={series.id}
            seriesKey={series.key}
            currentEpisode={episode.number}
            totalEpisodes={series.episodeCount}
            fileName={episode.key}
            startTime={Math.max(0, savedTime - RESUME_REWIND_SECONDS)}
            nextEpisodeTitle={nextEpisode ? buildEpisodeTitle(series.title, nextEpisode.key, nextEpisode.number) : undefined}
        />
    );
};

export default WatchPage;
