import type { EpisodeProgress } from "@/lib/contracts";
import type { CatalogSeries } from "@/lib/catalog";

export interface SeriesSeason {
    id: string;
    number: number | null;
    label: string;
    seriesId: number;
    seriesKey: string;
    title: string;
    coverImage: string | null;
    episodes: CatalogSeries["episodes"];
}

const toSeason = (entry: CatalogSeries): SeriesSeason => ({
    id: entry.seasonNumber === null ? "all" : String(entry.seasonNumber),
    number: entry.seasonNumber,
    label: entry.seasonNumber === null ? "Wszystkie odcinki" : `Sezon ${entry.seasonNumber}`,
    seriesId: entry.id,
    seriesKey: entry.key,
    title: entry.title,
    coverImage: entry.sourceCoverImage,
    episodes: entry.episodes,
});

export const getSeriesDisplayTitle = (series: CatalogSeries) => series.baseTitle ?? series.title;

export const getSeriesSeasons = (
    catalog: CatalogSeries[],
    current: CatalogSeries,
): SeriesSeason[] => {
    if (current.groupId === null) {
        return [toSeason({ ...current, seasonNumber: null })];
    }

    const members = catalog.filter((entry) => entry.groupId === current.groupId);
    const group = members.length > 0 ? members : [current];

    return group
        .map(toSeason)
        .sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER));
};

export const getKnownProgressPercent = (progress?: EpisodeProgress) => {
    if (!progress) return 0;
    if (progress.completed) return 100;
    if (!progress.durationSeconds || progress.durationSeconds <= 0) return 0;
    return Math.min(100, Math.round((progress.positionSeconds / progress.durationSeconds) * 100));
};

export const formatRemainingTime = (progress?: EpisodeProgress) => {
    if (!progress?.durationSeconds || progress.completed) return null;
    const remaining = Math.max(0, progress.durationSeconds - progress.positionSeconds);
    if (remaining <= 0) return null;
    const minutes = Math.ceil(remaining / 60);
    return `${minutes} min do końca`;
};

export const formatEpisodeNumber = (number: number) =>
    new Intl.NumberFormat("pl-PL", { minimumIntegerDigits: 2 }).format(number);

export const currentUnixTime = () => Date.now() / 1000;
