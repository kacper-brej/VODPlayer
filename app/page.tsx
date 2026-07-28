import { Suspense } from "react";
import HeroBanerSection from "@/components/series/HeroBanerSection";
import ContentRow from "@/components/series/ContentRow";
import ContentRowSkeleton from "@/components/series/ContentRowSkeleton";
import SeriesModal from "@/components/series/SeriesModal";
import HomeRefresher from "@/components/series/HomeRefresher";
import { getTopMovie } from "@/lib/fetchMoviePopular";
import { getMovieNewest } from "@/lib/fetchMovieNewest";
import { getCatalog, FALLBACK_COVER } from "@/lib/catalog";
import { getLatestResume, getResumeMap } from "@/lib/continueWatching";
import { getWatchlist } from "@/lib/watchlist";
import { progressPercent } from "@/lib/watchProgress";
import type { SeriesCardProps } from "@/components/series/SeriesCard";
import { DataErrorState, DataState } from "@/components/data/DataState";

const Hero = async () => {
    const [resumeResult, catalogResult] = await Promise.all([getLatestResume(), getCatalog()]);

    if (resumeResult.kind === "error") {
        return <DataErrorState reason={resumeResult.reason} />;
    }

    if (catalogResult.kind === "error") {
        return <DataErrorState reason={catalogResult.reason} />;
    }

    if (resumeResult.kind === "empty" || !resumeResult.data) {
        return <HeroBanerSection lastWatchedData={null} />;
    }

    const resume = resumeResult.data;
    const series = catalogResult.data.find((item) => item.key === resume.seriesKey);
    const episode = series?.episodes.find((item) => item.key === resume.episodeKey);

    if (!series || !episode) {
        return <HeroBanerSection lastWatchedData={null} />;
    }

    return (
        <HeroBanerSection
            lastWatchedData={{
                seriesId: series.id,
                title: series.title,
                episodeFile: resume.episodeKey,
                lastWatchedTime: resume.positionSeconds,
                progressPercent: progressPercent(resume.positionSeconds, resume.durationSeconds),
                image: series?.bannerImage || series?.coverImage || FALLBACK_COVER,
                video: episode?.url ?? "",
                description: series?.synopsis || "Kontynuuj oglądanie tam, gdzie skończyłeś.",
                tags: ["Kontynuuj"],
            }}
        />
    );
};

const LibraryRow = async () => {
    const [catalogResult, resumeResult, watchlistResult] = await Promise.all([
        getCatalog(),
        getResumeMap(),
        getWatchlist(),
    ]);

    if (catalogResult.kind === "error") {
        return <DataErrorState reason={catalogResult.reason} compact />;
    }

    if (resumeResult.kind === "error") {
        return <DataErrorState reason={resumeResult.reason} compact />;
    }

    if (catalogResult.kind === "empty") {
        return (
            <DataState
                kind="empty"
                title="Biblioteka jest pusta"
                description="Dodane seriale pojawią się w tym miejscu."
                compact
            />
        );
    }

    const watchlistedKeys = new Set(
        watchlistResult.kind === "success" ? watchlistResult.data.map((item) => item.seriesKey) : [],
    );

    const cards: SeriesCardProps[] = catalogResult.data.map((series) => {
        const resume = resumeResult.data.get(series.key);
        const episode = series.episodes.find((item) => item.key === resume?.episodeKey) ?? series.episodes[0];

        return {
            id: series.id,
            title: series.title,
            coverImage: series.coverImage,
            rating: series.rating,
            year: series.year ?? undefined,
            previewVideoUrl: episode?.url,
            resumeEpisodeKey: episode?.key,
            watchedSeconds: resume?.positionSeconds,
            durationSeconds: resume?.durationSeconds ?? undefined,
            seriesKey: series.key,
            inWatchlist: watchlistedKeys.has(series.key),
        };
    });

    return (
        <div className="animate-in fade-in duration-700 ease-out">
            <ContentRow title="Biblioteka" series={cards} />
        </div>
    );
};

const TopMovieRows = async () => {
    const result = await getTopMovie();

    if (result.kind === "error") {
        return <DataErrorState reason={result.reason} compact />;
    }

    if (result.kind === "empty") {
        return (
            <DataState
                kind="empty"
                title="Brak popularnych tytułów"
                description="Lista jest teraz pusta."
                compact
            />
        );
    }

    return (
        <>
            <ContentRow title="Hot takes" series={result.data} />
            <ContentRow title="Obejrzyj ponownie" series={result.data} />
        </>
    );
};

const NewestRow = async () => {
    const result = await getMovieNewest();

    if (result.kind === "error") {
        return <DataErrorState reason={result.reason} compact />;
    }

    if (result.kind === "empty") {
        return (
            <DataState
                kind="empty"
                title="Brak nowości"
                description="Lista jest teraz pusta."
                compact
            />
        );
    }

    return <ContentRow title="Nowości" series={result.data} />;
};

export default function Home() {
    return (
        <main className="w-full min-w-0 max-w-full min-h-screen bg-background pb-20 overflow-x-hidden">
            <HomeRefresher />

            <Suspense fallback={null}>
                <Hero />
            </Suspense>

            <div className="mt-8 md:mt-12 flex flex-col gap-6 px-8">
                <Suspense fallback={<ContentRowSkeleton title="Biblioteka" />}>
                    <LibraryRow />
                </Suspense>
                <Suspense fallback={null}>
                    <TopMovieRows />
                </Suspense>
                <Suspense fallback={null}>
                    <NewestRow />
                </Suspense>
            </div>

            <Suspense fallback={null}>
                <SeriesModal />
            </Suspense>
        </main>
    );
}
