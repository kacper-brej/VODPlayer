import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import EpisodeList, { type SeasonEpisodes } from "@/components/episodes/EpisodeList";
import { DataErrorState, DataState } from "@/components/data/DataState";
import SeriesHero from "@/components/series/SeriesHero";
import SeriesMetadata from "@/components/series/SeriesMetadata";
import { getCatalog, resolveCatalogSeries } from "@/lib/catalog/catalog";
import { getProgressSnapshotAction } from "@/lib/progress/getProgressAction";
import { seriesPath } from "@/lib/core/routes";
import {
    getSeriesDisplayTitle,
    getSeriesSeasons,
    currentUnixTime,
    formatEpisodeNumber,
    formatRemainingTime,
    getKnownProgressPercent,
} from "@/lib/catalog/seriesPage";
import { resolvePreviewSource } from "@/lib/player/videoAccess";

interface SeriesPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ season?: string | string[] }>;
}

const decodeSeriesId = (id: string): string => {
    try {
        return decodeURIComponent(id);
    } catch {
        return id;
    }
};

export const generateMetadata = async ({ params }: Pick<SeriesPageProps, "params">): Promise<Metadata> => {
    const { id } = await params;
    const result = await resolveCatalogSeries(decodeSeriesId(id));

    if (result.kind === "error" || !result.data) {
        return { title: "Serial niedostępny | Nocturna" };
    }

    return {
        title: `${getSeriesDisplayTitle(result.data)} | Nocturna`,
        ...(result.data.synopsis ? { description: result.data.synopsis } : {}),
    };
};

const SeriesPage = async ({ params, searchParams }: SeriesPageProps) => {
    const [{ id: rawId }, query, catalogResult] = await Promise.all([params, searchParams, getCatalog()]);
    const id = decodeSeriesId(rawId);

    if (catalogResult.kind === "error") {
        return (
            <div className="min-h-screen bg-nx-bg px-5 py-28 sm:px-8">
                <DataErrorState reason={catalogResult.reason} headingLevel={1} />
            </div>
        );
    }

    if (catalogResult.data.length === 0) {
        return (
            <div className="min-h-screen bg-nx-bg px-5 py-28 sm:px-8">
                <DataState
                    kind="empty"
                    title="Katalog jest pusty"
                    description="Dodaj pierwszy tytuł, aby pojawił się na stronie serialu."
                />
            </div>
        );
    }

    const seriesResult = await resolveCatalogSeries(id);
    if (seriesResult.kind === "error") {
        return (
            <div className="min-h-screen bg-nx-bg px-5 py-28 sm:px-8">
                <DataErrorState reason={seriesResult.reason} headingLevel={1} />
            </div>
        );
    }
    if (!seriesResult.data) notFound();

    const series = seriesResult.data;
    if (id !== String(series.id)) permanentRedirect(seriesPath(series.id));

    const seasons = getSeriesSeasons(catalogResult.data, series);
    const displayTitle = getSeriesDisplayTitle(series);
    const requestedSeason = Array.isArray(query.season) ? query.season[0] : query.season;
    const initialSeason = seasons.some((season) => season.id === requestedSeason)
        ? requestedSeason as string
        : seasons.find((season) => season.seriesId === series.id)?.id ?? seasons[0]?.id ?? "all";

    const progressResult = await getProgressSnapshotAction(seasons.map((season) => season.seriesKey));
    const progressEntries = seasons.map((season) => {
        const episodes = progressResult.kind === "error" ? {} : progressResult.data.episodesBySeries[season.seriesKey] ?? {};
        const resume = progressResult.kind === "error"
            ? null
            : progressResult.data.resumes.find((item) => item.seriesKey === season.seriesKey) ?? null;
        return { season, episodes, resume };
    });

    const now = currentUnixTime();
    const seasonViews: SeasonEpisodes[] = progressEntries.map(({ season, episodes: progress, resume }) => {
        const firstNewEpisode = season.episodes.find((episode) =>
            !progress[episode.key] && now - episode.addedAt < 7 * 24 * 60 * 60
        )?.key;

        const episodes = season.episodes.map((episode) => {
            const stored = progress[episode.key];
            const entry = stored
                ? { ...stored, durationSeconds: stored.durationSeconds ?? episode.durationSeconds }
                : undefined;
            const watched = entry?.completed === true;
            const percent = getKnownProgressPercent(entry);

            return {
                id: `${season.seriesId}-${episode.key}`,
                seriesId: season.seriesId,
                episodeKey: episode.key,
                episodeNumber: episode.number,
                title: episode.title ?? `Odcinek ${formatEpisodeNumber(episode.number)}`,
                fileName: episode.key,
                thumbnail: episode.thumbnail ?? series.backdropImage ?? series.sourceCoverImage,
                percent,
                remainingTime: formatRemainingTime(entry),
                watched,
                started: Boolean(entry && entry.positionSeconds > 0 && !watched),
                progressKnown: Boolean(entry?.durationSeconds && entry.durationSeconds > 0),
                isNew: episode.key === firstNewEpisode,
                previewSource: resolvePreviewSource(
                    season.seriesKey,
                    episode,
                    entry?.positionSeconds ?? null,
                ),
            };
        });

        return {
            id: season.id,
            label: season.label,
            episodeCount: episodes.length,
            completed: episodes.length > 0 && episodes.every((episode) => episode.watched),
            seriesId: season.seriesId,
            episodes,
            resumeEpisodeKey: resume?.episodeKey ?? null,
        };
    });

    const activeProgress = progressEntries.find(({ season }) => season.id === initialSeason);
    const activeSeason = seasons.find((season) => season.id === initialSeason) ?? seasons[0];
    const resumeEpisodeKey = activeProgress?.resume?.episodeKey ?? null;
    const resumeEpisodeNumber = activeSeason?.episodes.find((episode) => episode.key === resumeEpisodeKey)?.number ?? null;
    const allEpisodes = seasons.flatMap((season) => season.episodes);
    const addedAt = allEpisodes.length > 0
        ? Math.min(...allEpisodes.map((episode) => episode.addedAt))
        : null;
    const progressAvailable = progressResult.kind !== "error";
    const authRequired = progressResult.kind === "error"
        && (progressResult.reason === "unauthorized" || progressResult.reason === "forbidden");

    return (
        <div className="min-h-screen bg-nx-bg text-nx-text">
            <div className="relative">
                <SeriesHero
                    seriesId={activeSeason?.seriesId ?? series.id}
                    seriesKey={activeSeason?.seriesKey ?? series.key}
                    title={displayTitle}
                    backdropImage={series.backdropImage}
                    logoImage={series.logoImage}
                    placeholder={series.backdropPlaceholder ?? series.placeholder}
                    synopsis={series.synopsis}
                    year={series.year}
                    rating={series.sourceRating}
                    ageRating={series.ageRating}
                    episodeCount={allEpisodes.length}
                    resumeEpisodeKey={resumeEpisodeKey}
                    resumeEpisodeNumber={resumeEpisodeNumber}
                    firstEpisodeKey={activeSeason?.episodes[0]?.key ?? null}
                    dominantColor={series.backdropDominantColor ?? series.dominantColor}
                    focalX={series.focalX}
                    focalY={series.focalY}
                    safeLeft={series.safeLeft}
                    safeBottom={series.safeBottom}
                />

                <div className={`pointer-events-none relative z-20 mx-auto grid w-full max-w-[1440px] grid-cols-4 gap-x-4 px-5 sm:px-8 lg:grid-cols-12 lg:gap-x-5 lg:px-10 xl:-mt-[calc(58vh-96px)] xl:min-h-[calc(58vh-96px)] xl:px-11 2xl:-mt-[calc(62vh-96px)] 2xl:min-h-[calc(62vh-96px)] 2xl:px-12 ${series.synopsis ? "mt-8 mb-16" : "mt-0 mb-10"}`}>
                    <div className="pointer-events-auto col-span-4 lg:col-span-12 xl:col-span-4 xl:col-start-9">
                        <SeriesMetadata
                            year={series.year}
                            rating={series.sourceRating}
                            episodeCount={allEpisodes.length}
                            addedAt={addedAt}
                            progressAvailable={progressAvailable}
                            genres={series.genres}
                            studio={series.studio}
                            audioLanguages={series.audioLanguages}
                            subtitleLanguages={series.subtitleLanguages}
                        />
                    </div>
                </div>
            </div>

            <EpisodeList
                seasons={seasonViews}
                initialSeason={initialSeason}
                authRequired={authRequired}
            />
        </div>
    );
};

export default SeriesPage;
