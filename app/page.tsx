import Link from "next/link";
import { Suspense } from "react";
import HeroBanerSection, { type LastWatchedData } from "@/components/series/HeroBanerSection";
import ContentRowSection from "@/components/series/ContentRowSection";
import ContentRowSkeleton from "@/components/series/ContentRowSkeleton";
import SeriesModal from "@/components/series/SeriesModal";
import HomeRefresher from "@/components/series/HomeRefresher";
import { DataErrorState } from "@/components/data/DataState";
import { getCatalog, type CatalogSeries } from "@/lib/catalog";
import { collapseSeriesGroups, getNewestSeries } from "@/lib/catalogRows";
import { getContinueWatching, getLatestResume, getResumeMap } from "@/lib/continueWatching";
import { getWeeklyRanking, RANKING_MIN_ITEMS } from "@/lib/rankings";
import { getWatchlist } from "@/lib/watchlist";
import { toContentCard, toResumeCard } from "@/lib/contentCards";
import { seriesPath, watchPath } from "@/lib/routes";
import type { ResumePoint } from "@/lib/contracts";

const watchlistKeys = (items: { seriesKey: string }[]) =>
    new Set(items.map((item) => item.seriesKey));

const heroData = (
    series: CatalogSeries,
    resume: ResumePoint | null,
): LastWatchedData | null => {
    const episode = series.episodes.find((item) => item.key === resume?.episodeKey)
        ?? series.episodes[0]
        ?? null;

    if (!episode) return null;

    const hasDuration = Boolean(resume?.durationSeconds && resume.durationSeconds > 0);
    const percent = resume && hasDuration
        ? Math.min(100, Math.round((resume.positionSeconds / resume.durationSeconds!) * 100))
        : null;

    return {
        seriesKey: series.key,
        title: series.baseTitle ?? series.title,
        episodeFile: episode.key,
        episodeNumber: episode.number,
        lastWatchedTime: resume?.positionSeconds ?? 0,
        progressPercent: percent,
        poster: series.sourceCoverImage,
        backdrop: series.backdropImage,
        logo: series.logoImage,
        dominantColor: series.backdropDominantColor ?? series.dominantColor,
        placeholder: series.backdropPlaceholder ?? series.placeholder,
        safeLeft: series.safeLeft,
        safeBottom: series.safeBottom,
        focal: {
            x: series.focalX ?? 0.5,
            y: series.focalY ?? 0.4,
        },
        video: episode.url,
        description: series.synopsis,
        href: watchPath(series.key, episode.key),
        isResume: Boolean(resume),
    };
};

const HeroSection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const resumeResult = await getLatestResume();
    const resume = resumeResult.kind === "success" ? resumeResult.data : null;
    const resumedSeries = resume
        ? catalog.find((series) => series.key === resume.seriesKey) ?? null
        : null;
    const recommendedSeries = getNewestSeries(catalog)
        .find((series) => series.episodes.length > 0)
        ?? catalog.find((series) => series.episodes.length > 0)
        ?? null;
    const content = resumedSeries
        ? heroData(resumedSeries, resume)
        : recommendedSeries
            ? heroData(recommendedSeries, null)
            : null;

    return <HeroBanerSection lastWatchedData={content} />;
};

const ContinueSection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const [continueResult, watchlistResult] = await Promise.all([
        getContinueWatching(),
        getWatchlist(),
    ]);

    if (continueResult.kind === "error") {
        if (continueResult.reason === "unauthorized") return null;
        return <DataErrorState reason={continueResult.reason} compact />;
    }

    if (continueResult.kind === "empty") return null;

    const byKey = new Map(catalog.map((series) => [series.key, series]));
    const listed = watchlistKeys(
        watchlistResult.kind === "success" ? watchlistResult.data : [],
    );
    const cards = continueResult.data
        .map((resume) => {
            const series = byKey.get(resume.seriesKey);
            return series ? toResumeCard(series, resume, listed.has(series.key)) : null;
        })
        .filter((card) => card !== null);

    return (
        <ContentRowSection
            title="Kontynuuj oglądanie"
            kicker="N° 01"
            variant="progress"
            items={cards}
        />
    );
};

const RankingSection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const [rankingResult, resumeResult, watchlistResult] = await Promise.all([
        getWeeklyRanking(),
        getResumeMap(),
        getWatchlist(),
    ]);

    if (rankingResult.kind === "error") {
        if (rankingResult.reason === "unauthorized") return null;
        return <DataErrorState reason={rankingResult.reason} compact />;
    }

    if (rankingResult.kind === "empty") return null;

    const byKey = new Map(catalog.map((series) => [series.key, series]));
    const resumeMap = resumeResult.kind === "error"
        ? new Map<string, ResumePoint>()
        : resumeResult.data;
    const listed = watchlistKeys(
        watchlistResult.kind === "success" ? watchlistResult.data : [],
    );
    const cards = rankingResult.data
        .slice(0, 10)
        .map((ranking) => {
            const series = byKey.get(ranking.seriesKey);
            return series
                ? toContentCard(series, {
                    resume: resumeMap.get(series.key),
                    inWatchlist: listed.has(series.key),
                    allowNew: false,
                })
                : null;
        })
        .filter((card) => card !== null);

    if (cards.length < RANKING_MIN_ITEMS) return null;

    return (
        <ContentRowSection
            title="Dziesiątka tej nocy"
            kicker="N° 02"
            variant="ranking"
            items={cards}
        />
    );
};

const SelectedSection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const [resumeResult, watchlistResult] = await Promise.all([
        getResumeMap(),
        getWatchlist(),
    ]);
    const resumeMap = resumeResult.kind === "error"
        ? new Map<string, ResumePoint>()
        : resumeResult.data;
    const listed = watchlistKeys(
        watchlistResult.kind === "success" ? watchlistResult.data : [],
    );
    const collapsed = getNewestSeries(collapseSeriesGroups(catalog), 20);
    const selected = [
        ...collapsed.filter((series) => listed.has(series.key)),
        ...collapsed.filter((series) => !listed.has(series.key) && !resumeMap.has(series.key)),
        ...collapsed.filter((series) => !listed.has(series.key) && resumeMap.has(series.key)),
    ].filter((series, index, all) =>
        all.findIndex((item) => item.key === series.key) === index
    ).slice(0, 4);
    const cards = selected.map((series) =>
        toContentCard(series, {
            resume: resumeMap.get(series.key),
            inWatchlist: listed.has(series.key),
        })
    );

    return (
        <ContentRowSection
            title="Wybrane dla Ciebie"
            kicker="N° 03"
            variant="mosaic"
            items={cards}
        />
    );
};

const LibrarySection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const [resumeResult, watchlistResult] = await Promise.all([
        getResumeMap(),
        getWatchlist(),
    ]);
    const resumeMap = resumeResult.kind === "error"
        ? new Map<string, ResumePoint>()
        : resumeResult.data;
    const listed = watchlistKeys(
        watchlistResult.kind === "success" ? watchlistResult.data : [],
    );
    const cards = collapseSeriesGroups(catalog).map((series) =>
        toContentCard(series, {
            resume: resumeMap.get(series.key),
            inWatchlist: listed.has(series.key),
            href: seriesPath(series.key),
        })
    );

    return (
        <ContentRowSection
            title="Biblioteka"
            kicker="N° 04"
            variant="classic"
            items={cards}
        />
    );
};

const EmptyArchive = () => (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-start justify-center px-5 sm:px-8">
        <span className="font-mono text-[11px] tracking-[0.22em] text-nx-text-2">
            ARCHIWUM / 0 TYTUŁÓW
        </span>
        <h1 className="mt-4 max-w-[12ch] font-display text-[34px] leading-[.95] tracking-[-0.03em] text-nx-text sm:text-[44px]">
            Archiwum jest puste
        </h1>
        <p className="mt-5 max-w-[40ch] text-[15px] leading-[1.65] text-nx-text-2">
            Wyślij pierwszy plik, a pojawi się tutaj wraz z odcinkami.
        </p>
        <Link
            href="/upload"
            className="mt-7 flex min-h-12 items-center rounded-full bg-nx-accent px-6 text-[15px] font-semibold text-nx-on-accent outline-none transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--nx-accent)_88%,var(--nx-text))] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
        >
            Wyślij plik
        </Link>
    </div>
);

const HomeDashboard = async () => {
    const catalogResult = await getCatalog();

    if (catalogResult.kind === "error") {
        return (
            <div className="px-5 py-16 sm:px-8 xl:px-10 min-[1440px]:px-12">
                <DataErrorState reason={catalogResult.reason} headingLevel={1} />
            </div>
        );
    }

    if (catalogResult.kind === "empty") return <EmptyArchive />;

    const catalog = catalogResult.data;

    return (
        <>
            <Suspense fallback={<div className="h-[46vh] min-h-80 w-full bg-nx-panel skeleton-pulse lg:h-[52vh] lg:min-h-105 xl:h-[58vh] xl:min-h-130 min-[1440px]:h-[62vh]" />}>
                <HeroSection catalog={catalog} />
            </Suspense>

            <div className="flex flex-col gap-12 px-5 py-12 sm:px-8 lg:gap-[72px] lg:py-[72px] xl:gap-[88px] xl:px-10 xl:py-[88px] min-[1440px]:gap-24 min-[1440px]:px-12 min-[1440px]:py-24">
                <Suspense fallback={<ContentRowSkeleton title="Kontynuuj oglądanie" kicker="N° 01" variant="progress" />}>
                    <ContinueSection catalog={catalog} />
                </Suspense>

                <Suspense fallback={<ContentRowSkeleton title="Dziesiątka tej nocy" kicker="N° 02" variant="ranking" />}>
                    <RankingSection catalog={catalog} />
                </Suspense>

                <Suspense fallback={<ContentRowSkeleton title="Wybrane dla Ciebie" kicker="N° 03" variant="mosaic" />}>
                    <SelectedSection catalog={catalog} />
                </Suspense>

                <Suspense fallback={<ContentRowSkeleton title="Biblioteka" kicker="N° 04" variant="classic" />}>
                    <LibrarySection catalog={catalog} />
                </Suspense>
            </div>
        </>
    );
};

export default function Home() {
    return (
        <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-nx-bg">
            <HomeRefresher />

            <Suspense fallback={<div className="min-h-screen bg-nx-bg" />}>
                <HomeDashboard />
            </Suspense>

            <Suspense fallback={null}>
                <SeriesModal />
            </Suspense>
        </div>
    );
}
