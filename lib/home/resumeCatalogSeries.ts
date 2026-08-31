import "server-only";
import {
    resolveCatalogSeries,
    type CatalogSeries,
} from "@/lib/catalog/catalog";
import {
    getVirtualTmdbEpisodes,
    parseVirtualEpisodeKey,
    parseVirtualTmdbRef,
} from "@/lib/catalog/tmdbVirtualSeries";
import type { ResumePoint } from "@/lib/core/contracts";
import type { DataResult } from "@/lib/core/dataResult";
import { selectResumeHero } from "@/lib/home/homeHero";

interface ResumeCatalogSources {
    resolveSeries: (query: string) => Promise<DataResult<CatalogSeries | null>>;
    loadEpisodes: (tmdbId: number, seasonNumber: number) => Promise<CatalogSeries["episodes"]>;
}

const defaultSources: ResumeCatalogSources = {
    resolveSeries: resolveCatalogSeries,
    loadEpisodes: getVirtualTmdbEpisodes,
};

export const resolveResumeCatalogSeries = async (
    catalog: readonly CatalogSeries[],
    resume: ResumePoint | null,
    sources: ResumeCatalogSources = defaultSources,
): Promise<CatalogSeries | null> => {
    const localSeries = selectResumeHero(catalog, resume);
    if (localSeries || !resume) return localSeries;

    const virtualRef = parseVirtualTmdbRef(resume.seriesKey);
    const episodeRef = parseVirtualEpisodeKey(resume.episodeKey);
    if (!virtualRef || !episodeRef) return null;
    if (virtualRef.kind === "movie" && (episodeRef.season !== 1 || episodeRef.episode !== 1)) return null;

    const result = await sources.resolveSeries(resume.seriesKey);
    if (result.kind !== "success" || !result.data) return null;

    let series = result.data;
    if (virtualRef.kind === "tv" && series.seasonNumber !== episodeRef.season) {
        const episodes = await sources.loadEpisodes(virtualRef.id, episodeRef.season);
        series = {
            ...series,
            seasonNumber: episodeRef.season,
            episodeCount: episodes.length,
            episodes,
        };
    }

    return series.episodes.some((episode) => episode.key === resume.episodeKey)
        ? series
        : null;
};
