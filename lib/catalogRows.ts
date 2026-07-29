import type { CatalogSeries } from "@/lib/catalog";
import type { CatalogGenre } from "@/lib/contracts";

export const newestEpisodeAddedAt = (series: CatalogSeries) =>
    series.episodes.reduce((latest, episode) => Math.max(latest, episode.addedAt), 0);

export const collapseSeriesGroups = (catalog: CatalogSeries[]): CatalogSeries[] => {
    const seenGroups = new Map<number, CatalogSeries>();
    const collapsed: CatalogSeries[] = [];

    for (const series of catalog) {
        if (series.groupId === null) {
            collapsed.push(series);
            continue;
        }

        const current = seenGroups.get(series.groupId);

        if (!current) {
            seenGroups.set(series.groupId, series);
            collapsed.push(series);
            continue;
        }

        const currentSeason = current.seasonNumber ?? Number.MAX_SAFE_INTEGER;
        const candidateSeason = series.seasonNumber ?? Number.MAX_SAFE_INTEGER;

        if (candidateSeason < currentSeason) {
            seenGroups.set(series.groupId, series);
            collapsed.splice(collapsed.indexOf(current), 1, series);
        }
    }

    return collapsed;
};

export const getCatalogGenres = (catalog: CatalogSeries[]): CatalogGenre[] => {
    const bySlug = new Map<string, CatalogGenre>();

    for (const series of catalog) {
        for (const genre of series.genres) {
            if (!bySlug.has(genre.slug)) bySlug.set(genre.slug, genre);
        }
    }

    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
};

export const filterCatalogByGenres = (catalog: CatalogSeries[], slugs: string[]): CatalogSeries[] => {
    if (slugs.length === 0) return catalog;

    const wanted = new Set(slugs);

    return catalog.filter((series) => series.genres.some((genre) => wanted.has(genre.slug)));
};

export const getNewestSeries = (catalog: CatalogSeries[], limit = 20): CatalogSeries[] =>
    [...collapseSeriesGroups(catalog)]
        .sort((a, b) => newestEpisodeAddedAt(b) - newestEpisodeAddedAt(a))
        .slice(0, limit);
