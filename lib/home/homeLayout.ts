import "server-only";
import type { CatalogSeries } from "@/lib/catalog/catalog";
import { catalogSeriesIdentity } from "@/lib/catalog/tmdbCatalogMapping";
import type { HomeRow, HomeRowId, HomeRowResult } from "@/lib/home/homeRowTypes";

export type HomeSectionId = HomeRowId | "continue" | "library";

export type HomeSectionVariant = "classic" | "ranking" | "progress";

export interface HomeSectionRow {
    id: HomeSectionId;
    title: string;
    variant: HomeSectionVariant;
    items: CatalogSeries[];
}

export const HOME_SECTION_ORDER = [
    "continue",
    "trending-today",
    "newest-local",
    "popular-now",
    "watchlist",
    "recommendations",
    "top-rated",
    "on-the-air",
    "library",
] as const satisfies readonly HomeSectionId[];

export const HOME_SECTION_PRESENTATION = {
    continue: { title: "Kontynuuj oglądanie", variant: "progress" },
    "trending-today": { title: "Top 10 trendów dzisiaj", variant: "ranking" },
    "newest-local": { title: "Najnowsze w Nocturna", variant: "classic" },
    "popular-now": { title: "Popularne teraz", variant: "classic" },
    watchlist: { title: "Moja lista", variant: "classic" },
    recommendations: { title: "Ponieważ oglądałeś", variant: "classic" },
    "top-rated": { title: "Najwyżej oceniane", variant: "classic" },
    "on-the-air": { title: "Nowe odcinki w tym tygodniu", variant: "classic" },
    library: { title: "Biblioteka", variant: "classic" },
} as const satisfies Record<HomeSectionId, { title: string; variant: HomeSectionVariant }>;

const DEDUP_MIN_ITEMS = 3;

const DEDUP_EXEMPT = new Set<HomeSectionId>(["continue", "watchlist", "library"]);

const DEDUP_FILTERED = new Set<HomeSectionId>([
    "trending-today",
    "popular-now",
    "recommendations",
    "top-rated",
    "on-the-air",
]);

const orderIndex = (id: HomeSectionId): number => HOME_SECTION_ORDER.indexOf(id);

export const readyHomeRows = (results: readonly HomeRowResult[]): HomeRow[] =>
    results.flatMap((result) => result.kind === "ready" ? [result.row] : []);

export const applyCrossSectionDedup = (
    rows: readonly HomeSectionRow[],
): HomeSectionRow[] => {
    const shown = new Set<string>();

    return [...rows]
        .sort((left, right) => orderIndex(left.id) - orderIndex(right.id))
        .map((row) => {
            if (DEDUP_EXEMPT.has(row.id)) return row;

            const filtered = DEDUP_FILTERED.has(row.id)
                ? row.items.filter((series) => !shown.has(catalogSeriesIdentity(series)))
                : row.items;
            const items = filtered.length >= DEDUP_MIN_ITEMS ? filtered : row.items;

            for (const series of items) shown.add(catalogSeriesIdentity(series));

            return { ...row, items };
        });
};

export const planHomeSections = (
    rows: readonly HomeSectionRow[],
): HomeSectionRow[] =>
    applyCrossSectionDedup(rows.filter((row) => row.items.length > 0))
        .filter((row) => row.items.length > 0);
