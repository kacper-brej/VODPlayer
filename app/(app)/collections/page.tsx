import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight, FolderOpen } from "lucide-react";
import { DataErrorState } from "@/components/data/DataState";
import CatalogGrid from "@/components/series/CatalogGrid";
import SeriesCard from "@/components/series/SeriesCard";
import SeriesModal from "@/components/series/SeriesModal";
import {
    CollectionControls,
    CreateCollectionForm,
    RemoveFromCollectionButton,
} from "@/components/collections/CollectionManager";
import { getCatalog } from "@/lib/catalog/catalog";
import { toContentCard } from "@/lib/catalog/contentCards";
import { getCollection, getCollections, type CollectionSummary } from "@/lib/collections/collections";
import { getResumeMap } from "@/lib/progress/continueWatching";
import { getWatchlist } from "@/lib/watchlist/watchlist";

type CollectionsSearchParams = Promise<Record<string, string | string[] | undefined>>;

const firstValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] ?? "" : value ?? "";

const itemCountLabel = (count: number) => count === 1 ? "1 TYTUŁ" : `${count} TYTUŁÓW`;

const CollectionDirectory = ({ collections }: { collections: CollectionSummary[] }) => {
    if (collections.length === 0) {
        return (
            <div className="flex min-h-72 flex-col items-start justify-center border-y border-nx-border py-12">
                <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2">
                    KOLEKCJE / 0
                </span>
                <h2 className="mt-3 max-w-[16ch] font-display text-[30px] leading-[.98] tracking-[-0.03em] text-nx-text sm:text-[40px]">
                    Nie masz jeszcze kolekcji
                </h2>
                <p className="mt-4 max-w-[40ch] text-[15px] leading-[1.65] text-nx-text-2">
                    Zapisane zestawy tytułów pojawią się w tym miejscu.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection, index) => (
                <Link
                    key={collection.id}
                    href={`/collections?collection=${collection.id}`}
                    className="group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-2xl border border-nx-border bg-nx-panel p-6 outline-none transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-nx-accent/50 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
                >
                    <span aria-hidden="true" className="absolute -right-2 -top-8 font-display text-[118px] leading-none text-transparent opacity-40 [-webkit-text-stroke:1px_color-mix(in_srgb,var(--nx-accent)_38%,transparent)]">
                        {String(index + 1).padStart(2, "0")}
                    </span>
                    <FolderOpen size={22} className="relative text-nx-accent" aria-hidden="true" />
                    <span className="relative mt-8 flex items-end justify-between gap-4">
                        <span className="min-w-0">
                            <span className="block truncate text-xl font-semibold text-nx-text">
                                {collection.name}
                            </span>
                            <span className="mt-2 block font-mono text-[10px] tracking-[0.16em] text-nx-text-2">
                                {itemCountLabel(collection.itemCount)}
                            </span>
                        </span>
                        <ArrowUpRight size={20} className="shrink-0 text-nx-text-2 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-nx-accent" aria-hidden="true" />
                    </span>
                </Link>
            ))}
        </div>
    );
};

const CollectionDetailView = async ({ collectionId }: { collectionId: number }) => {
    const [collectionResult, catalogResult, resumeResult, watchlistResult] = await Promise.all([
        getCollection(collectionId),
        getCatalog(),
        getResumeMap(),
        getWatchlist(),
    ]);

    if (collectionResult.kind === "error") {
        return <DataErrorState reason={collectionResult.reason} />;
    }

    if (catalogResult.kind === "error") {
        return <DataErrorState reason={catalogResult.reason} />;
    }

    const byKey = new Map(catalogResult.data.map((series) => [series.key, series]));
    const resumeMap = resumeResult.kind === "error" ? new Map() : resumeResult.data;
    const listed = new Set(
        watchlistResult.kind === "success"
            ? watchlistResult.data.map((item) => item.seriesKey)
            : [],
    );
    const cards = collectionResult.data.items.flatMap((seriesKey) => {
        const series = byKey.get(seriesKey);
        return series
            ? [toContentCard(series, {
                resume: resumeMap.get(series.key),
                inWatchlist: listed.has(series.key),
            })]
            : [];
    });
    const currentKeys = new Set(collectionResult.data.items);
    const availableSeries = catalogResult.data
        .filter((series) => !currentKeys.has(series.key))
        .map((series) => ({
            key: series.key,
            title: series.baseTitle ?? series.title,
        }))
        .sort((a, b) => a.title.localeCompare(b.title, "pl"));

    return (
        <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-nx-border pb-6">
                <div>
                    <Link
                        href="/collections"
                        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-nx-text-2 outline-none hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        Wszystkie kolekcje
                    </Link>
                    <h2 className="mt-3 font-display text-[30px] leading-none tracking-[-0.03em] text-nx-text sm:text-[38px]">
                        {collectionResult.data.name}
                    </h2>
                </div>
                <span className="font-mono text-[10px] tracking-[0.18em] text-nx-text-2">
                    {itemCountLabel(cards.length)}
                </span>
            </div>

            <CollectionControls
                collectionId={collectionResult.data.id}
                collectionName={collectionResult.data.name}
                availableSeries={availableSeries}
            />

            {cards.length === 0 ? (
                <div className="flex min-h-64 items-center border-y border-nx-border py-10">
                    <p className="max-w-md text-sm leading-6 text-nx-text-2">
                        Ta kolekcja jest pusta. Dodane do niej tytuły pojawią się tutaj.
                    </p>
                </div>
            ) : (
                <CatalogGrid ariaLabel={`Tytuły w kolekcji ${collectionResult.data.name}`}>
                    {cards.map((item, index) => (
                        <div key={item.seriesKey} role="row" className="min-w-0 lg:col-span-6 xl:col-span-4">
                            <div role="gridcell">
                                <div className="relative z-20 mb-4 flex items-center gap-3">
                                    <span className="font-mono text-[10px] tracking-[0.18em] text-nx-text-2">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>
                                    <span className="h-px flex-1 bg-nx-border" />
                                    <RemoveFromCollectionButton
                                        collectionId={collectionResult.data.id}
                                        seriesKey={item.seriesKey}
                                        title={item.title}
                                    />
                                </div>
                                <SeriesCard
                                    item={item}
                                    variant="mosaic"
                                    imagePreload={index === 0}
                                    sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 50vw, 33vw"
                                    tabIndex={0}
                                    catalog
                                />
                            </div>
                        </div>
                    ))}
                </CatalogGrid>
            )}
        </>
    );
};

const CollectionsPage = async ({ searchParams }: { searchParams: CollectionsSearchParams }) => {
    const [params, collectionsResult] = await Promise.all([searchParams, getCollections()]);

    if (collectionsResult.kind === "error") {
        return (
            <div className="min-h-screen bg-nx-bg px-5 py-16 sm:px-8 xl:px-10 min-[1440px]:px-12">
                <DataErrorState reason={collectionsResult.reason} headingLevel={1} />
            </div>
        );
    }

    const rawCollectionId = Number.parseInt(firstValue(params.collection), 10);
    const collectionId = Number.isSafeInteger(rawCollectionId) && rawCollectionId > 0
        ? rawCollectionId
        : null;

    return (
        <div className="min-h-screen bg-nx-bg px-5 pb-[calc(80px+env(safe-area-inset-bottom))] pt-12 sm:px-8 lg:pb-20 lg:pt-16 xl:px-10 min-[1440px]:px-12">
            <header className="mb-10 max-w-4xl sm:mb-12">
                <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2 sm:text-[11px]">
                    TWOJE ZESTAWY / {collectionsResult.data.length}
                </span>
                <h1 className="mt-4 max-w-[14ch] text-balance font-display text-[34px] leading-[.95] tracking-[-0.03em] text-nx-text sm:text-[40px] lg:text-[44px]">
                    Kolekcje na każdą noc
                </h1>
            </header>

            {collectionId ? (
                <CollectionDetailView collectionId={collectionId} />
            ) : (
                <>
                    <CreateCollectionForm />
                    <CollectionDirectory collections={collectionsResult.data} />
                </>
            )}

            <Suspense fallback={null}>
                <SeriesModal />
            </Suspense>
        </div>
    );
};

export default CollectionsPage;
