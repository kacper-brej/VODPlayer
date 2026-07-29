import { Suspense } from "react";
import HeroBanerSection from "@/components/series/HeroBanerSection";
import ContentRow from "@/components/series/ContentRow";
import ContentRowSkeleton from "@/components/series/ContentRowSkeleton";
import SeriesModal from "@/components/series/SeriesModal";
import HomeRefresher from "@/components/series/HomeRefresher";
import { getCatalog, FALLBACK_COVER, type CatalogSeries } from "@/lib/catalog";
import { getWeeklyRanking, RANKING_MIN_ITEMS } from "@/lib/rankings";
import { collapseSeriesGroups, getNewestSeries } from "@/lib/catalogRows";
import { getLatestResume, getResumeMap } from "@/lib/continueWatching";
import { getWatchlist } from "@/lib/watchlist";
import { progressPercent } from "@/lib/watchProgress";
import type { SeriesCardProps } from "@/components/series/SeriesCard";
import type { ResumePoint } from "@/lib/contracts";
import { DataErrorState, DataState } from "@/components/data/DataState";

const toSeriesCard = (
    series: CatalogSeries,
    resumeMap: Map<string, ResumePoint>,
    watchlistedKeys: Set<string>,
): SeriesCardProps => {
    const resume = resumeMap.get(series.key);
    const episode = series.episodes.find((item) => item.key === resume?.episodeKey) ?? series.episodes[0];

    return {
        id: series.id,
        title: series.baseTitle ?? series.title,
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
};

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

    const cards = collapseSeriesGroups(catalogResult.data).map((series) =>
        toSeriesCard(series, resumeResult.data, watchlistedKeys)
    );

    return (
        <div className="animate-in fade-in duration-700 ease-out">
            <ContentRow title="Biblioteka" series={cards} />
        </div>
    );
};

const RankingRow = async () => {
    const [rankingResult, catalogResult, resumeResult, watchlistResult] = await Promise.all([
        getWeeklyRanking(),
        getCatalog(),
        getResumeMap(),
        getWatchlist(),
    ]);

    if (rankingResult.kind !== "success" || catalogResult.kind !== "success") return null;

    const byKey = new Map(catalogResult.data.map((series) => [series.key, series]));
    const resumeMap = resumeResult.kind === "error" ? new Map<string, ResumePoint>() : resumeResult.data;
    const watchlistedKeys = new Set(
        watchlistResult.kind === "success" ? watchlistResult.data.map((item) => item.seriesKey) : [],
    );

    const ranked = rankingResult.data
        .map((item) => byKey.get(item.seriesKey))
        .filter((series): series is CatalogSeries => series !== undefined)
        .map((series) => toSeriesCard(series, resumeMap, watchlistedKeys));

    if (ranked.length < RANKING_MIN_ITEMS) return null;

    return <ContentRow title="Dziesiątka tej nocy" series={ranked} />;
};

const NewestRow = async () => {
    const [catalogResult, resumeResult, watchlistResult] = await Promise.all([
        getCatalog(),
        getResumeMap(),
        getWatchlist(),
    ]);

    if (catalogResult.kind !== "success") return null;

    const resumeMap = resumeResult.kind === "error" ? new Map<string, ResumePoint>() : resumeResult.data;
    const watchlistedKeys = new Set(
        watchlistResult.kind === "success" ? watchlistResult.data.map((item) => item.seriesKey) : [],
    );

    const newest = getNewestSeries(catalogResult.data).map((series) =>
        toSeriesCard(series, resumeMap, watchlistedKeys)
    );

    if (newest.length === 0) return null;

    return <ContentRow title="Nowości" series={newest} />;
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
                    <RankingRow />
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
