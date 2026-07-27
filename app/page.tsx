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
import { progressPercent } from "@/lib/watchProgress";
import type { SeriesCardProps } from "@/components/series/SeriesCard";

const Hero = async () => {
    const [resume, catalog] = await Promise.all([getLatestResume(), getCatalog()]);

    if (!resume) return <HeroBanerSection lastWatchedData={null} />;

    const series = catalog.find((item) => item.key === resume.seriesKey);
    const episode = series?.episodes.find((item) => item.key === resume.episodeKey);

    return (
        <HeroBanerSection
            lastWatchedData={{
                seriesId: resume.seriesKey,
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
    const [catalog, resumeMap] = await Promise.all([getCatalog(), getResumeMap()]);

    if (catalog.length === 0) return null;

    const cards: SeriesCardProps[] = catalog.map((series) => {
        const resume = resumeMap.get(series.key);
        const episode = series.episodes.find((item) => item.key === resume?.episodeKey) ?? series.episodes[0];

        return {
            id: series.id,
            title: series.title,
            seriesKey: series.key,
            coverImage: series.coverImage,
            rating: series.rating,
            year: series.year ?? undefined,
            previewVideoUrl: episode?.url,
            resumeEpisodeKey: episode?.key,
            watchedSeconds: resume?.positionSeconds,
            durationSeconds: resume?.durationSeconds ?? undefined,
        };
    });

    return (
        <div className="animate-in fade-in duration-700 ease-out">
            <ContentRow title="Biblioteka" series={cards} />
        </div>
    );
};

const TopMovieRows = async () => {
    const topMovie = await getTopMovie();

    return (
        <>
            <ContentRow title="Hot takes" series={topMovie} />
            <ContentRow title="Obejrzyj ponownie" series={topMovie} />
        </>
    );
};

const NewestRow = async () => {
    const newestMovie = await getMovieNewest();
    return <ContentRow title="Nowości" series={newestMovie} />;
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
