import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import type { TmdbTvListItem } from "@/lib/core/contracts";

export interface TmdbCatalogMappingStats {
    inputCount: number;
    matchedCount: number;
    rejectedCount: number;
    duplicateCount: number;
}

export interface TmdbCatalogMappingResult {
    series: CatalogSeries[];
    stats: TmdbCatalogMappingStats;
}

export const catalogSeriesIdentity = (series: CatalogSeries): string =>
    series.groupId === null ? `series:${series.key}` : `group:${series.groupId}`;

const compareRepresentatives = (left: CatalogSeries, right: CatalogSeries): number => {
    const seasonDifference = (left.seasonNumber ?? Number.MAX_SAFE_INTEGER)
        - (right.seasonNumber ?? Number.MAX_SAFE_INTEGER);

    return seasonDifference || left.key.localeCompare(right.key, "pl");
};

export const getCatalogRepresentatives = (
    catalog: readonly CatalogSeries[],
): ReadonlyMap<string, CatalogSeries> => {
    const representatives = new Map<string, CatalogSeries>();

    for (const series of catalog) {
        const identity = catalogSeriesIdentity(series);
        const current = representatives.get(identity);
        if (!current || compareRepresentatives(series, current) < 0) {
            representatives.set(identity, series);
        }
    }

    return representatives;
};

const buildTmdbIndex = (
    catalog: readonly CatalogSeries[],
    representatives: ReadonlyMap<string, CatalogSeries>,
): ReadonlyMap<number, CatalogSeries | null> => {
    const index = new Map<number, CatalogSeries | null>();

    for (const series of catalog) {
        if (series.tmdbExternalId === null) continue;

        const representative = representatives.get(catalogSeriesIdentity(series));
        if (!representative) continue;

        const current = index.get(series.tmdbExternalId);
        if (current === undefined) {
            index.set(series.tmdbExternalId, representative);
        } else if (current && catalogSeriesIdentity(current) !== catalogSeriesIdentity(representative)) {
            index.set(series.tmdbExternalId, null);
        }
    }

    return index;
};

export const mapTmdbListToCatalog = (
    items: readonly Pick<TmdbTvListItem, "id">[],
    catalog: readonly CatalogSeries[],
    limit: number,
): TmdbCatalogMappingResult => {
    const maxItems = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
    const representatives = getCatalogRepresentatives(catalog);
    const byTmdbId = buildTmdbIndex(catalog, representatives);
    const seenTmdbIds = new Set<number>();
    const seenSeries = new Set<string>();
    const matched: CatalogSeries[] = [];
    let rejectedCount = 0;
    let duplicateCount = 0;

    for (const item of items) {
        if (seenTmdbIds.has(item.id)) {
            duplicateCount += 1;
            continue;
        }
        seenTmdbIds.add(item.id);

        const series = byTmdbId.get(item.id);
        if (!series) {
            rejectedCount += 1;
            continue;
        }

        const identity = catalogSeriesIdentity(series);
        if (seenSeries.has(identity)) {
            duplicateCount += 1;
            continue;
        }

        if (matched.length >= maxItems) {
            rejectedCount += 1;
            continue;
        }

        seenSeries.add(identity);
        matched.push(series);
    }

    return {
        series: matched,
        stats: {
            inputCount: items.length,
            matchedCount: matched.length,
            rejectedCount,
            duplicateCount,
        },
    };
};
