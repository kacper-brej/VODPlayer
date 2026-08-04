import "server-only";

import type { CardInput } from "@/components/series/SeriesCard";
import type { CatalogSeries } from "@/lib/catalog";
import type { ResumePoint } from "@/lib/contracts";
import { seriesPath, watchPath } from "@/lib/routes";

const NEW_EPISODE_WINDOW_SECONDS = 7 * 24 * 60 * 60;

interface ContentCardOptions {
    resume?: ResumePoint | null;
    inWatchlist?: boolean;
    href?: string;
    completed?: boolean;
    allowNew?: boolean;
}

export const newestEpisode = (series: CatalogSeries) =>
    series.episodes.reduce<(typeof series.episodes)[number] | null>(
        (latest, episode) => !latest || episode.addedAt > latest.addedAt ? episode : latest,
        null,
    );

export const toContentCard = (
    series: CatalogSeries,
    {
        resume = null,
        inWatchlist = false,
        href,
        completed,
        allowNew = true,
    }: ContentCardOptions = {},
): CardInput => {
    const episode = series.episodes.find((entry) => entry.key === resume?.episodeKey)
        ?? series.episodes[0]
        ?? null;
    const latest = newestEpisode(series);
    const hasProgress = Boolean(resume?.positionSeconds);
    const isNew = allowNew
        && !hasProgress
        && Boolean(latest)
        && latest!.addedAt >= Math.floor(Date.now() / 1000) - NEW_EPISODE_WINDOW_SECONDS;

    return {
        seriesKey: series.key,
        title: series.baseTitle ?? series.title ?? series.key,
        poster: series.coverImage,
        backdrop: series.backdropImage,
        focal: {
            x: series.focalX ?? 0.5,
            y: series.focalY ?? 0.4,
        },
        dominantColor: series.dominantColor,
        placeholder: series.placeholder,
        posterDominantColor: series.posterDominantColor,
        posterPlaceholder: series.posterPlaceholder,
        backdropDominantColor: series.backdropDominantColor,
        backdropPlaceholder: series.backdropPlaceholder,
        year: series.year,
        seasonNumber: series.seasonNumber,
        genres: series.genres.map((genre) => genre.name),
        score: series.sourceRating,
        ageRating: series.ageRating,
        description: series.synopsis,
        episodeKey: episode?.key,
        episodeNumber: episode?.number,
        positionSeconds: resume?.positionSeconds,
        durationSeconds: resume?.durationSeconds,
        completed,
        addedAt: latest?.addedAt,
        isNew,
        href: href ?? seriesPath(series.key),
        infoId: series.id,
        inWatchlist,
    };
};

export const toResumeCard = (
    series: CatalogSeries,
    resume: ResumePoint,
    inWatchlist = false,
) => toContentCard(series, {
    resume,
    inWatchlist,
    href: watchPath(series.key, resume.episodeKey),
    allowNew: false,
});
