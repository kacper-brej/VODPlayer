import Link from "next/link";
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

export type CatalogMode = "all" | "genres" | "collections" | "watchlist";

export type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;

interface CatalogScreenProps {
    mode: CatalogMode;
    basePath: string;
    searchParams: CatalogSearchParams;
}

const PAGE_SIZE = 24;
const spanPattern = [8, 4, 4, 4, 4, 6, 6, 3, 3, 3, 3] as const;

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
            <main className="min-h-screen bg-nx-bg px-5 py-16 sm:px-8 xl:px-10 min-[1440px]:px-12">
                <DataErrorState reason={catalogResult.reason} />
            </main>
        );
    }

    if (mode === "watchlist" && watchlistResult.kind === "error") {
        return (
            <main className="min-h-screen bg-nx-bg px-5 py-16 sm:px-8 xl:px-10 min-[1440px]:px-12">
                <DataErrorState reason={watchlistResult.reason} />
            </main>
        );
    }

    const query = firstValue(params.q).trim();
    const sort = ["newest", "title", "year", "score"].includes(firstValue(params.sort))
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

    const normalizedQuery = query.toLocaleLowerCase("pl");
    const filtered = source.filter((series) => {
        const matchesQuery = !normalizedQuery || [
            series.title,
            series.baseTitle,
            series.key,
            series.synopsis,
        ].some((value) => value?.toLocaleLowerCase("pl").includes(normalizedQuery));
        const matchesGenre = !genre || series.genres.some((item) => item.slug === genre);
        return matchesQuery && matchesGenre;
    });
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
        <main className="min-h-screen bg-nx-bg px-5 pb-[calc(80px+env(safe-area-inset-bottom))] pt-12 sm:px-8 lg:pb-20 lg:pt-16 xl:px-10 min-[1440px]:px-12">
            <header className="max-w-4xl">
                <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2 sm:text-[11px]">
                    {copy.kicker} / {source.length} {source.length === 1 ? "TYTUŁ" : "TYTUŁÓW"}
                </span>
                <h1 className="mt-4 max-w-[14ch] text-balance font-display text-[34px] leading-[.95] tracking-[-0.03em] text-nx-text sm:text-[40px] lg:text-[44px]">
                    {copy.title}
                </h1>
            </header>

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
                        />
                    </div>

                    <div className="mt-10 sm:mt-12">
                        {sorted.length === 0 ? (
                            <EmptyCatalog mode={mode} filtered={filtersActive} basePath={basePath} />
                        ) : (
                            <CatalogGrid>
                                {visible.map((series, index) => {
                                    const span = spanPattern[index % spanPattern.length];
                                    const featured = span >= 6;
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
                                                <div className="mb-2 flex items-center gap-3">
                                                    <span className="font-mono text-[10px] tracking-[0.18em] text-nx-text-2">
                                                        {String(index + 1).padStart(2, "0")}
                                                    </span>
                                                    <span className="h-px flex-1 bg-nx-border" />
                                                </div>
                                                <SeriesCard
                                                    item={{
                                                        ...item,
                                                        previewVideoUrl: undefined,
                                                    }}
                                                    variant="mosaic"
                                                    featured={featured}
                                                    imagePreload={index === 0}
                                                    sizes={imageSizes(span)}
                                                    tabIndex={0}
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
        </main>
    );
};

export default CatalogScreen;
