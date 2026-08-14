import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { DataErrorState } from "@/components/data/DataState";
import CatalogGrid from "@/components/series/CatalogGrid";
import SeriesCard from "@/components/series/SeriesCard";
import SeriesModal from "@/components/series/SeriesModal";
import { getCatalog } from "@/lib/catalog/catalog";
import { toResumeCard } from "@/lib/catalog/contentCards";
import { getContinueWatching } from "@/lib/progress/continueWatching";
import { getWatchlist } from "@/lib/watchlist/watchlist";

const EmptyContinueWatching = () => (
    <div className="flex min-h-64 flex-col items-start justify-center border-y border-nx-border py-10">
        <span className="font-mono text-[10px] tracking-[0.2em] text-nx-text-2">
            HISTORIA / 0 TYTUŁÓW
        </span>
        <h2 className="mt-4 font-display text-2xl tracking-[-0.02em] text-nx-text sm:text-3xl">
            Nic nie czeka na dokończenie
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-nx-text-2">
            Rozpoczęte odcinki pojawią się tutaj, aby można było szybko wrócić do oglądania.
        </p>
        <Link
            href="/explore"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-nx-border bg-nx-panel px-5 text-sm font-semibold text-nx-text outline-none transition-colors duration-140 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
        >
            Przejdź do katalogu
            <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
    </div>
);

const ContinueWatchingContent = async () => {
    const [catalogResult, continueResult, watchlistResult] = await Promise.all([
        getCatalog(),
        getContinueWatching(),
        getWatchlist(),
    ]);

    if (catalogResult.kind === "error") {
        return <DataErrorState reason={catalogResult.reason} headingLevel={1} />;
    }

    if (continueResult.kind === "error") {
        return <DataErrorState reason={continueResult.reason} headingLevel={1} />;
    }

    const byKey = new Map(catalogResult.data.map((series) => [series.key, series]));
    const listed = new Set(
        watchlistResult.kind === "success"
            ? watchlistResult.data.map((item) => item.seriesKey)
            : [],
    );
    const cards = continueResult.data.flatMap((resume) => {
        const series = byKey.get(resume.seriesKey);
        return series ? [toResumeCard(series, resume, listed.has(series.key))] : [];
    });

    if (cards.length === 0) return <EmptyContinueWatching />;

    return (
        <CatalogGrid ariaLabel="Rozpoczęte tytuły">
            {cards.map((item, index) => (
                <div
                    key={`${item.seriesKey}:${item.episodeKey ?? "episode"}`}
                    role="row"
                    className="min-w-0 lg:col-span-6 xl:col-span-4"
                >
                    <div role="gridcell">
                        <div className="relative z-20 mb-4 flex items-center gap-3">
                            <span className="font-mono text-[10px] tracking-[0.18em] text-nx-text-2">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="h-px flex-1 bg-nx-border" />
                        </div>
                        <SeriesCard
                            item={item}
                            variant="landscape"
                            imagePreload={index < 2}
                            sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 50vw, 33vw"
                            tabIndex={0}
                        />
                    </div>
                </div>
            ))}
        </CatalogGrid>
    );
};

const ContinueWatchingPage = () => (
    <main className="min-h-screen w-full min-w-0 bg-nx-bg px-5 py-12 sm:px-8 lg:py-16 xl:px-10 min-[1440px]:px-12">
        <div className="mx-auto w-full max-w-[1600px]">
            <header className="mb-10 border-b border-nx-border pb-8 sm:mb-12">
                <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2">
                    HISTORIA OGLĄDANIA
                </span>
                <h1 className="mt-4 max-w-[12ch] font-display text-[34px] leading-[.95] tracking-[-0.03em] text-nx-text sm:text-[44px]">
                    Kontynuuj oglądanie
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-nx-text-2">
                    Wróć dokładnie do miejsca, w którym ostatnio przerwałeś.
                </p>
            </header>

            <ContinueWatchingContent />
        </div>

        <Suspense fallback={null}>
            <SeriesModal />
        </Suspense>
    </main>
);

export default ContinueWatchingPage;
