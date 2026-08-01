import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import EpisodeList, { type SeasonEpisodes } from "@/components/episodes/EpisodeList";
import { DataErrorState, DataState } from "@/components/data/DataState";
import SeriesHero from "@/components/series/SeriesHero";
import SeriesMetadata from "@/components/series/SeriesMetadata";
import { getCatalog, resolveCatalogSeries } from "@/lib/catalog";
import { getSeriesProgressAction } from "@/lib/getProgressAction";
import { seriesPath } from "@/lib/routes";
import {
    getSeriesDisplayTitle,
    getSeriesSeasons,
    currentUnixTime,
    formatEpisodeNumber,
    formatRemainingTime,
    getKnownProgressPercent,
} from "@/lib/seriesPage";

interface SeriesPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ season?: string | string[] }>;
}

export const generateMetadata = async ({ params }: Pick<SeriesPageProps, "params">): Promise<Metadata> => {
    const { id } = await params;
    const result = await resolveCatalogSeries(id);

    if (result.kind === "error" || !result.data) {
        return { title: "Serial niedostępny | Nocturna" };
    }

    return {
        title: `${getSeriesDisplayTitle(result.data)} | Nocturna`,
        ...(result.data.synopsis ? { description: result.data.synopsis } : {}),
    };
};

const SeriesPage = async ({ params, searchParams }: SeriesPageProps) => {
    const [{ id }, query, catalogResult] = await Promise.all([params, searchParams, getCatalog()]);

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

    const progressEntries = await Promise.all(
        seasons.map(async (season) => ({
            season,
            result: await getSeriesProgressAction(season.seriesKey),
        })),
    );

    const now = currentUnixTime();
    const seasonViews: SeasonEpisodes[] = progressEntries.map(({ season, result }) => {
        const progress = result.kind === "error" ? {} : result.data.episodes;
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
                thumbnail: episode.thumbnail ?? season.coverImage,
                percent,
                remainingTime: formatRemainingTime(entry),
                watched,
                started: Boolean(entry && entry.positionSeconds > 0 && !watched),
                progressKnown: Boolean(entry?.durationSeconds && entry.durationSeconds > 0),
                isNew: episode.key === firstNewEpisode,
            };
        });

        return {
            id: season.id,
            label: season.label,
            episodeCount: episodes.length,
            completed: episodes.length > 0 && episodes.every((episode) => episode.watched),
            seriesId: season.seriesId,
            episodes,
            resumeEpisodeKey: result.kind === "error" ? null : result.data.resume?.episodeKey ?? null,
        };
    });

    const activeProgress = progressEntries.find(({ season }) => season.id === initialSeason)?.result;
    const activeSeason = seasons.find((season) => season.id === initialSeason) ?? seasons[0];
    const resumeEpisodeKey = activeProgress && activeProgress.kind !== "error"
        ? activeProgress.data.resume?.episodeKey ?? null
        : null;
    const resumeEpisodeNumber = activeSeason?.episodes.find((episode) => episode.key === resumeEpisodeKey)?.number ?? null;
    const allEpisodes = seasons.flatMap((season) => season.episodes);
    const addedAt = allEpisodes.length > 0
        ? Math.min(...allEpisodes.map((episode) => episode.addedAt))
        : null;
    const progressAvailable = progressEntries.every(({ result }) => result.kind !== "error");
    const authRequired = progressEntries.some(({ result }) =>
        result.kind === "error" && (result.reason === "unauthorized" || result.reason === "forbidden")
    );

    return (
        <div className="min-h-screen bg-nx-bg text-nx-text">
            <div className="relative">
                <SeriesHero
                    seriesId={activeSeason?.seriesId ?? series.id}
                    title={displayTitle}
                    coverImage={series.sourceCoverImage}
                    backdropImage={series.backdropImage}
                    synopsis={series.synopsis}
                    year={series.year}
                    rating={series.sourceRating}
                    ageRating={series.ageRating}
                    episodeCount={allEpisodes.length}
                    resumeEpisodeKey={resumeEpisodeKey}
                    resumeEpisodeNumber={resumeEpisodeNumber}
                    firstEpisodeKey={activeSeason?.episodes[0]?.key ?? null}
                    dominantColor={series.dominantColor}
                    focalX={series.focalX}
                    focalY={series.focalY}
                />

                <div className={`relative z-20 mx-auto grid w-full max-w-[1440px] grid-cols-4 gap-x-4 px-5 sm:px-8 lg:grid-cols-12 lg:gap-x-5 lg:px-10 xl:-mt-[calc(58vh-96px)] xl:min-h-[calc(58vh-96px)] xl:px-11 2xl:-mt-[calc(62vh-96px)] 2xl:min-h-[calc(62vh-96px)] 2xl:px-12 ${series.synopsis ? "mt-8 mb-16" : "mt-0 mb-10"}`}>
                    <div className="col-span-4 lg:col-span-12 xl:col-span-4 xl:col-start-9">
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
