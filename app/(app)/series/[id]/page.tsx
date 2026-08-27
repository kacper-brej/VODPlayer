import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import EpisodeList, { type SeasonEpisodes } from "@/components/episodes/EpisodeList";
import { DataErrorState, DataState } from "@/components/data/DataState";
import SeriesHero from "@/components/series/SeriesHero";
import SeriesMetadata from "@/components/series/SeriesMetadata";
import { getCatalog, resolveCatalogSeries, type CatalogSeries } from "@/lib/catalog/catalog";
import {
    getVirtualTmdbEpisodesResult,
    getVirtualTmdbSeasons,
    isVirtualTmdbTvKey,
} from "@/lib/catalog/tmdbVirtualSeries";
import { getProgressSnapshotAction } from "@/lib/progress/getProgressAction";
import { seriesPath } from "@/lib/core/routes";
import {
    getSeriesDisplayTitle,
    getSeriesSeasons,
    getSeasonEpisodeCount,
    type SeriesSeason,
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

const resolveSeasons = async (
    series: CatalogSeries,
    catalog: CatalogSeries[],
    requestedSeason: string | undefined,
): Promise<SeriesSeason[]> => {
    const local = getSeriesSeasons(catalog, series);

    if (!isVirtualTmdbTvKey(series.key) || series.tmdbExternalId === null) return local;

    const available = await getVirtualTmdbSeasons(series.tmdbExternalId);
    if (available.length === 0) return local;

    const requested = Number(requestedSeason);
    const activeNumber = available.some((season) => season.number === requested)
        ? requested
        : available[0].number;
    const activeEpisodesResult = await getVirtualTmdbEpisodesResult(series.tmdbExternalId, activeNumber);
    const activeEpisodes = activeEpisodesResult.kind === "error" ? [] : activeEpisodesResult.data;

    return available.map((season) => ({
        id: String(season.number),
        number: season.number,
        label: season.label,
        seriesId: series.id,
        seriesKey: series.key,
        title: series.title,
        coverImage: series.sourceCoverImage,
        episodes: season.number === activeNumber ? activeEpisodes : [],
        declaredEpisodeCount: season.episodeCount,
        ...(season.number === activeNumber && activeEpisodesResult.kind === "error"
            ? { loadError: activeEpisodesResult.reason }
            : {}),
        source: {
            ...series,
            year: season.year ?? series.year,
            synopsis: season.synopsis ?? series.synopsis,
            sourceRating: season.rating ?? series.sourceRating,
        },
    }));
};

const SeriesPage = async ({ params, searchParams }: SeriesPageProps) => {
    const [{ id: rawId }, query, catalogResult] = await Promise.all([params, searchParams, getCatalog()]);
    const id = decodeSeriesId(rawId);

    if (catalogResult.kind === "error") {
        return (
            <div className="min-h-dvh bg-nx-bg px-5 py-28 sm:px-8">
                <DataErrorState reason={catalogResult.reason} headingLevel={1} />
            </div>
        );
    }

    const seriesResult = await resolveCatalogSeries(id);
    if (seriesResult.kind === "error") {
        return (
            <div className="min-h-dvh bg-nx-bg px-5 py-28 sm:px-8">
                <DataErrorState reason={seriesResult.reason} headingLevel={1} />
            </div>
        );
    }

    if (!seriesResult.data) {
        if (catalogResult.data.length === 0) {
            return (
                <div className="min-h-dvh bg-nx-bg px-5 py-28 sm:px-8">
                    <DataState
                        kind="empty"
                        title="Katalog jest pusty"
                        description="Dodaj pierwszy tytuł, aby pojawił się na stronie serialu."
                    />
                </div>
            );
        }

        notFound();
    }

    const series = seriesResult.data;
    if (id !== String(series.id)) permanentRedirect(seriesPath(series.id));

    const displayTitle = getSeriesDisplayTitle(series);
    const requestedSeason = Array.isArray(query.season) ? query.season[0] : query.season;
    const seasons = await resolveSeasons(series, catalogResult.data, requestedSeason);
    const initialSeason = seasons.some((season) => season.id === requestedSeason)
        ? requestedSeason as string
        : seasons.find((season) => season.seriesId === series.id)?.id ?? seasons[0]?.id ?? "all";
    const activeSeason = seasons.find((season) => season.id === initialSeason) ?? seasons[0];
    const activeSeries = activeSeason?.source ?? series;

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
                thumbnail: episode.thumbnail ?? season.source.backdropImage ?? season.source.sourceCoverImage,
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
            episodeCount: episodes.length > 0 ? episodes.length : season.declaredEpisodeCount ?? 0,
            completed: episodes.length > 0 && episodes.every((episode) => episode.watched),
            seriesId: season.seriesId,
            episodes,
            resumeEpisodeKey: resume?.episodeKey ?? null,
            loadError: season.loadError ?? null,
        };
    });

    const activeProgress = progressEntries.find(({ season }) => season.id === initialSeason);
    const resumeEpisodeKey = activeProgress?.resume?.episodeKey ?? null;
    const resumeEpisodeNumber = activeSeason?.episodes.find((episode) => episode.key === resumeEpisodeKey)?.number ?? null;
    const activeEpisodes = activeSeason?.episodes ?? [];
    const activeEpisodeCount = getSeasonEpisodeCount(activeSeason);
    const addedAt = activeEpisodes.length > 0
        ? Math.min(...activeEpisodes.map((episode) => episode.addedAt))
        : null;
    const progressAvailable = progressResult.kind !== "error";
    const authRequired = progressResult.kind === "error"
        && (progressResult.reason === "unauthorized" || progressResult.reason === "forbidden");

    return (
        <div className="min-h-dvh bg-nx-bg text-nx-text">
            <div className="relative">
                <SeriesHero
                    seriesId={activeSeason?.seriesId ?? series.id}
                    seriesKey={activeSeason?.seriesKey ?? series.key}
                    title={displayTitle}
                    backdropImage={activeSeries.backdropImage}
                    logoImage={activeSeries.logoImage}
                    placeholder={activeSeries.backdropPlaceholder ?? activeSeries.placeholder}
                    synopsis={activeSeries.synopsis}
                    year={activeSeries.year}
                    rating={activeSeries.sourceRating}
                    ageRating={activeSeries.ageRating}
                    episodeCount={activeEpisodeCount}
                    resumeEpisodeKey={resumeEpisodeKey}
                    resumeEpisodeNumber={resumeEpisodeNumber}
                    firstEpisodeKey={activeSeason?.episodes[0]?.key ?? null}
                    dominantColor={activeSeries.backdropDominantColor ?? activeSeries.dominantColor}
                    focalX={activeSeries.focalX}
                    focalY={activeSeries.focalY}
                    safeLeft={activeSeries.safeLeft}
                    safeBottom={activeSeries.safeBottom}
                />

                <div className={`pointer-events-none relative z-20 mx-auto grid w-full max-w-[1440px] grid-cols-4 gap-x-4 px-5 sm:px-8 lg:grid-cols-12 lg:gap-x-5 lg:px-10 xl:-mt-[calc(58vh-96px)] xl:min-h-[calc(58vh-96px)] xl:px-11 2xl:-mt-[calc(62vh-96px)] 2xl:min-h-[calc(62vh-96px)] 2xl:px-12 ${activeSeries.synopsis ? "mt-8 mb-16" : "mt-0 mb-10"}`}>
                    <div className="pointer-events-auto col-span-4 lg:col-span-12 xl:col-span-4 xl:col-start-9">
                        <SeriesMetadata
                            year={activeSeries.year}
                            rating={activeSeries.sourceRating}
                            episodeCount={activeEpisodeCount}
                            addedAt={addedAt}
                            progressAvailable={progressAvailable}
                            genres={activeSeries.genres}
                            studio={activeSeries.studio}
                            audioLanguages={activeSeries.audioLanguages}
                            subtitleLanguages={activeSeries.subtitleLanguages}
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
