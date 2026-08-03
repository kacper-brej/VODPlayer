import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CatalogFilterBar from "@/components/series/CatalogFilterBar";
import CatalogGrid from "@/components/series/CatalogGrid";
import SeriesCard from "@/components/series/SeriesCard";
import { DataErrorState } from "@/components/data/DataState";
import { getCatalog, type CatalogSeries } from "@/lib/catalog";
import { collapseSeriesGroups, getCatalogGenres, newestEpisodeAddedAt } from "@/lib/catalogRows";
import { getResumeMap } from "@/lib/continueWatching";
import { getWatchlist } from "@/lib/watchlist";
import { toContentCard } from "@/lib/contentCards";
import type { ResumePoint } from "@/lib/contracts";
import { prepareSearchEntries, searchEntries } from "@/lib/search";

export type CatalogMode = "all" | "genres" | "collections" | "watchlist";

export type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;

interface CatalogScreenProps {
    mode: CatalogMode;
    basePath: string;
    searchParams: CatalogSearchParams;
}

const PAGE_SIZE = 24;
const CATALOG_SORTS = new Set(["newest", "title", "year", "score"]);
const spanPatterns: Record<CatalogMode, readonly number[]> = {
    all: [6, 6, 4, 4, 4, 6, 6, 3, 3, 3, 3],
    genres: [4, 4, 4, 4, 4, 4],
    collections: [6, 6, 4, 4, 4],
    watchlist: [4, 4, 4, 4, 4, 4],
};

const firstValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";

const spanClass = (span: number) => {
    if (span === 8) return "lg:col-span-12 xl:col-span-8";
    if (span === 6) return "lg:col-span-6";
    if (span === 3) return "lg:col-span-4 xl:col-span-3";
    return "lg:col-span-6 xl:col-span-4";
};

const imageSizes = (span: number) => {
    if (span === 8) return "(max-width: 1023px) 100vw, (max-width: 1279px) 100vw, 66vw";
    if (span === 6) return "(max-width: 1023px) 100vw, 50vw";
    if (span === 3) return "(max-width: 1023px) 100vw, (max-width: 1279px) 33vw, 25vw";
    return "(max-width: 1023px) 100vw, 50vw, 33vw";
};

const screenCopy: Record<CatalogMode, {
    kicker: string;
    title: string;
    emptyTitle: string;
    emptyDescription: string;
}> = {
    all: {
        kicker: "KATALOG",
        title: "Czego szukasz tej nocy?",
        emptyTitle: "Archiwum jest puste",
        emptyDescription: "Wyślij pierwszy plik, aby rozpocząć budowanie katalogu.",
    },
    genres: {
        kicker: "GATUNKI",
        title: "Znajdź historię po nastroju",
        emptyTitle: "Brak opisanych gatunków",
        emptyDescription: "Gatunki pojawią się tutaj wraz z metadanymi tytułów.",
    },
    collections: {
        kicker: "KOLEKCJE",
        title: "Sezony zebrane w całość",
        emptyTitle: "Brak kolekcji",
        emptyDescription: "Kolekcje pojawią się, gdy katalog połączy sezony jednego tytułu.",
    },
    watchlist: {
        kicker: "MOJA LISTA",
        title: "Co zostawiłeś na później?",
        emptyTitle: "Twoja lista jest pusta",
        emptyDescription: "Dodaj tytuł z katalogu, aby zachować go na później.",
    },
};

const EmptyCatalog = ({
    mode,
    filtered,
    basePath,
}: {
    mode: CatalogMode;
    filtered: boolean;
    basePath: string;
}) => {
    const copy = screenCopy[mode];

    if (filtered) {
        return (
            <div className="flex min-h-72 flex-col items-start justify-center border-y border-nx-border py-12">
                <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2">
                    BRAK WYNIKÓW
                </span>
                <h2 className="mt-3 text-2xl font-semibold text-nx-text sm:font-display sm:text-[30px]">
                    Nic nie pasuje do tych filtrów
                </h2>
                <Link
                    href={basePath}
                    className="mt-6 flex min-h-11 items-center rounded-full border border-nx-border bg-nx-panel px-5 text-sm font-semibold text-nx-text outline-none transition-colors duration-140 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
                >
                    Wyczyść filtry
                </Link>
            </div>
        );
    }

    return (
        <div className="flex min-h-80 flex-col items-start justify-center border-y border-nx-border py-12">
            <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2">
                {copy.kicker} / 0 TYTUŁÓW
            </span>
            <h2 className="mt-3 max-w-[16ch] font-display text-[30px] leading-[.98] tracking-[-0.03em] text-nx-text sm:text-[40px]">
                {copy.emptyTitle}
            </h2>
            <p className="mt-4 max-w-[40ch] text-[15px] leading-[1.65] text-nx-text-2">
                {copy.emptyDescription}
            </p>
            <Link
                href={mode === "watchlist" ? "/explore" : "/upload"}
                className="mt-6 flex min-h-12 items-center rounded-full bg-nx-accent px-6 text-[15px] font-semibold text-nx-on-accent outline-none transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--nx-accent)_88%,var(--nx-text))] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
            >
                {mode === "watchlist" ? "Przejdź do katalogu" : "Wyślij plik"}
            </Link>
        </div>
    );
};

const GenreDirectory = ({
    catalog,
    genres,
    basePath,
}: {
    catalog: CatalogSeries[];
    genres: ReturnType<typeof getCatalogGenres>;
    basePath: string;
}) => {
    if (genres.length === 0) return null;

    return (
        <section aria-labelledby="genre-directory-title" className="mt-10 border-y border-nx-border py-8 sm:mt-12 sm:py-10">
            <div className="mb-6 flex items-end gap-4">
                <div>
                    <span className="font-mono text-[10px] tracking-[0.2em] text-nx-text-2">INDEKS NASTROJÓW</span>
                    <h2 id="genre-directory-title" className="mt-1 text-xl font-semibold text-nx-text sm:font-display sm:text-[28px]">
                        Wybierz swój klimat
                    </h2>
                </div>
                <span className="mb-2 h-px flex-1 bg-nx-border" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {genres.map((item, index) => {
                    const count = catalog.filter((series) =>
                        series.genres.some((genre) => genre.slug === item.slug)
                    ).length;

                    return (
                        <Link
                            key={item.slug}
                            href={`${basePath}?genre=${encodeURIComponent(item.slug)}`}
                            className="group relative flex min-h-28 items-end overflow-hidden rounded-2xl border border-nx-border bg-nx-panel p-5 outline-none transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-nx-accent/50 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                        >
                            <span aria-hidden="true" className="absolute -right-1 -top-5 font-display text-[92px] leading-none text-transparent opacity-45 [-webkit-text-stroke:1px_color-mix(in_srgb,var(--nx-accent)_42%,transparent)]">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="relative flex w-full items-end justify-between gap-4">
                                <span>
                                    <span className="block text-lg font-semibold text-nx-text">{item.name}</span>
                                    <span className="mt-1 block font-mono text-[10px] tracking-[0.14em] text-nx-text-2">
                                        {count} {count === 1 ? "TYTUŁ" : "TYTUŁÓW"}
                                    </span>
                                </span>
                                <ArrowUpRight size={20} className="shrink-0 text-nx-text-2 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-nx-accent" aria-hidden="true" />
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
};

const sortCatalog = (catalog: CatalogSeries[], sort: string) => {
    if (sort === "newest") {
        return [...catalog].sort((a, b) => newestEpisodeAddedAt(b) - newestEpisodeAddedAt(a));
    }

    if (sort === "title") {
        return [...catalog].sort((a, b) =>
            (a.baseTitle ?? a.title).localeCompare(b.baseTitle ?? b.title, "pl")
        );
    }

    if (sort === "year") {
        return [...catalog].sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
    }

    if (sort === "score") {
        return [...catalog].sort((a, b) =>
            (Number.parseFloat(b.sourceRating ?? "") || -1)
            - (Number.parseFloat(a.sourceRating ?? "") || -1)
        );
    }

    return catalog;
};

const CatalogScreen = async ({
    mode,
    basePath,
    searchParams,
}: CatalogScreenProps) => {
    const [params, catalogResult, resumeResult, watchlistResult] = await Promise.all([
        searchParams,
        getCatalog(),
        getResumeMap(),
        getWatchlist(),
    ]);
    const copy = screenCopy[mode];

    if (catalogResult.kind === "error") {
        return (
            <div className="min-h-screen bg-nx-bg px-5 py-16 sm:px-8 xl:px-10 min-[1440px]:px-12">
                <DataErrorState reason={catalogResult.reason} headingLevel={1} />
            </div>
        );
    }

    if (mode === "watchlist" && watchlistResult.kind === "error") {
        return (
            <div className="min-h-screen bg-nx-bg px-5 py-16 sm:px-8 xl:px-10 min-[1440px]:px-12">
                <DataErrorState reason={watchlistResult.reason} headingLevel={1} />
            </div>
        );
    }

    const query = firstValue(params.q).trim();
    const sort = CATALOG_SORTS.has(firstValue(params.sort))
        ? firstValue(params.sort)
        : "featured";
    const genre = firstValue(params.genre);
    const requestedPage = Number.parseInt(firstValue(params.page), 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, 100)
        : 1;
    const collapsed = collapseSeriesGroups(catalogResult.data);
    const listedItems = watchlistResult.kind === "success" ? watchlistResult.data : [];
    const listedKeys = new Set(listedItems.map((item) => item.seriesKey));
    const resumeMap = resumeResult.kind === "error"
        ? new Map<string, ResumePoint>()
        : resumeResult.data;
    const genres = getCatalogGenres(collapsed);

    let source = collapsed;

    if (mode === "collections") {
        source = collapseSeriesGroups(catalogResult.data.filter((series) => series.groupId !== null));
    } else if (mode === "watchlist") {
        const order = new Map(listedItems.map((item, index) => [item.seriesKey, index]));
        source = collapsed
            .filter((series) => listedKeys.has(series.key))
            .sort((a, b) => (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER));
    }

    const genreFiltered = source.filter((series) =>
        !genre || series.genres.some((item) => item.slug === genre)
    );
    const preparedSearch = prepareSearchEntries(genreFiltered.map((series) => ({
        key: series.key,
        title: series.baseTitle ?? series.title,
        altTitles: [series.title, ...series.altTitles],
        inWatchlist: listedKeys.has(series.key),
        hasProgress: resumeMap.has(series.key),
        series,
    })));
    const searchResults = query ? searchEntries(preparedSearch, query) : [];
    const filtered = query ? searchResults.map((result) => result.entry.series) : genreFiltered;
    const matchedBy = new Map(searchResults.map((result) => [result.entry.key, result]));
    const onlyFuzzyResults = searchResults.length > 0 && searchResults.every((result) => result.fuzzy);
    const sorted = sortCatalog(filtered, sort);
    const visible = sorted.slice(0, page * PAGE_SIZE);
    const hasMore = visible.length < sorted.length;
    const filtersActive = Boolean(query || genre || sort !== "featured");
    const nextParams = new URLSearchParams();

    if (query) nextParams.set("q", query);
    if (sort !== "featured") nextParams.set("sort", sort);
    if (genre) nextParams.set("genre", genre);
    nextParams.set("page", String(page + 1));

    return (
        <div className="min-h-screen bg-nx-bg px-5 pb-[calc(80px+env(safe-area-inset-bottom))] pt-12 sm:px-8 lg:pb-20 lg:pt-16 xl:px-10 min-[1440px]:px-12">
            <header className="max-w-4xl">
                <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2 sm:text-[11px]">
                    {copy.kicker} / {source.length} {source.length === 1 ? "TYTUŁ" : "TYTUŁÓW"}
                </span>
                <h1 className="mt-4 max-w-[14ch] text-balance font-display text-[34px] leading-[.95] tracking-[-0.03em] text-nx-text sm:text-[40px] lg:text-[44px]">
                    {copy.title}
                </h1>
            </header>

            {mode === "genres" && (
                <GenreDirectory catalog={collapsed} genres={genres} basePath={basePath} />
            )}

            {catalogResult.kind === "empty" || source.length === 0 ? (
                <div className="mt-10">
                    <EmptyCatalog mode={mode} filtered={false} basePath={basePath} />
                </div>
            ) : (
                <>
                    <div className="mt-8">
                        <CatalogFilterBar
                            basePath={basePath}
                            query={query}
                            sort={sort}
                            genre={genre}
                            genres={genres}
                            showGenres={mode !== "genres"}
                        />
                    </div>

                    <div className="mt-10 sm:mt-12">
                        {onlyFuzzyResults && (
                            <div className="mb-6 border-l-2 border-nx-accent bg-nx-panel px-4 py-3 text-sm text-nx-text">
                                Czy chodziło Ci o jeden z tych tytułów?
                            </div>
                        )}
                        {sorted.length === 0 ? (
                            <EmptyCatalog mode={mode} filtered={filtersActive} basePath={basePath} />
                        ) : (
                            <CatalogGrid>
                                {visible.map((series, index) => {
                                    const pattern = spanPatterns[mode];
                                    const span = pattern[index % pattern.length];
                                    const featured = span >= 6;
                                    const match = matchedBy.get(series.key);
                                    const item = toContentCard(series, {
                                        resume: resumeMap.get(series.key),
                                        inWatchlist: listedKeys.has(series.key),
                                    });

                                    return (
                                        <div
                                            key={series.key}
                                            role="row"
                                            className={`min-w-0 ${spanClass(span)}`}
                                        >
                                            <div role="gridcell">
                                                <div className="relative z-20 mb-4 flex items-center gap-3">
                                                    <span className="font-mono text-[10px] tracking-[0.18em] text-nx-text-2">
                                                        {String(index + 1).padStart(2, "0")}
                                                    </span>
                                                    <span className="h-px flex-1 bg-nx-border" />
                                                </div>
                                                {match?.matchedKind === "alternative" && (
                                                    <p className="mb-2 line-clamp-1 text-xs text-nx-text-2">
                                                        {match.matchedTitle} → {match.entry.title}
                                                    </p>
                                                )}
                                                <SeriesCard
                                                    item={{
                                                        ...item,
                                                    }}
                                                    variant="mosaic"
                                                    featured={featured}
                                                    imagePreload={index === 0}
                                                    sizes={imageSizes(span)}
                                                    tabIndex={0}
                                                    catalog
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </CatalogGrid>
                        )}
                    </div>

                    {hasMore && (
                        <div className="mt-12 flex justify-center">
                            <Link
                                href={`${basePath}?${nextParams.toString()}`}
                                className="flex min-h-11 items-center rounded-full border border-nx-border bg-nx-panel px-6 text-sm font-semibold text-nx-text outline-none transition-colors duration-140 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
                            >
                                Pokaż więcej
                            </Link>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CatalogScreen;
