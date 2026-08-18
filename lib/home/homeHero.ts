import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import { getNewestSeries } from "@/lib/catalog/catalogRows";
import type { ResumePoint } from "@/lib/core/contracts";

const isPlayable = (series: CatalogSeries): boolean => series.episodes.length > 0;

export const selectResumeHero = (
    catalog: readonly CatalogSeries[],
    resume: ResumePoint | null,
): CatalogSeries | null => {
    if (!resume) return null;

    const series = catalog.find((entry) => entry.key === resume.seriesKey) ?? null;

    return series && isPlayable(series) ? series : null;
};

export const selectFallbackHero = (
    catalog: readonly CatalogSeries[],
    trending: readonly CatalogSeries[],
): CatalogSeries | null =>
    trending.find(isPlayable)
        ?? getNewestSeries([...catalog]).find(isPlayable)
        ?? catalog.find(isPlayable)
        ?? null;
