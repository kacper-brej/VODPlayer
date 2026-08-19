import Link from "next/link";
import { Suspense } from "react";
import HeroBanerSection, { type LastWatchedData } from "@/components/series/HeroBanerSection";
import ContentRowSection from "@/components/series/ContentRowSection";
import ContentRowSkeleton from "@/components/series/ContentRowSkeleton";
import SeriesModal from "@/components/series/SeriesModal";
import { DataErrorState } from "@/components/data/DataState";
import { getCatalog, type CatalogSeries } from "@/lib/catalog/catalog";
import { collapseSeriesGroups } from "@/lib/catalog/catalogRows";
import { getContinueWatching, getLatestResume, getResumeMap } from "@/lib/progress/continueWatching";
import { getWatchlist } from "@/lib/watchlist/watchlist";
import { toContentCard, toResumeCard } from "@/lib/catalog/contentCards";
import { selectFallbackHero, selectResumeHero } from "@/lib/home/homeHero";
import { HOME_SECTION_PRESENTATION, type HomeSectionId, type HomeSectionRow } from "@/lib/home/homeLayout";
import { getHomeRowSections } from "@/lib/home/homeSections";
import { buildNewestHomeRow } from "@/lib/home/publicHomeRows";
import { buildWatchlistHomeRow } from "@/lib/home/personalizedHomeRows";
import { watchPath } from "@/lib/core/routes";
import type { ResumePoint } from "@/lib/core/contracts";
import { resolvePreviewSource } from "@/lib/player/videoAccess";
import { getSessionUser } from "@/lib/auth/session";

interface ViewerRowContext {
    resumeMap: Map<string, ResumePoint>;
    listed: Set<string>;
}

const getViewerRowContext = async (): Promise<ViewerRowContext> => {
    const [resumeResult, watchlistResult] = await Promise.all([
        getResumeMap(),
        getWatchlist(),
    ]);

    return {
        resumeMap: resumeResult.kind === "error" ? new Map<string, ResumePoint>() : resumeResult.data,
        listed: new Set(
            watchlistResult.kind === "success"
                ? watchlistResult.data.map((item) => item.seriesKey)
                : [],
        ),
    };
};

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
    const remainingMinutes = resume && hasDuration
        ? Math.max(0, Math.ceil((resume.durationSeconds! - resume.positionSeconds) / 60))
        : null;

    return {
        seriesKey: series.key,
        title: series.baseTitle ?? series.title,
        episodeFile: episode.key,
        episodeNumber: episode.number,
        lastWatchedTime: resume?.positionSeconds ?? 0,
        progressPercent: percent,
        remainingMinutes,
        infoId: series.id,
        year: series.year,
        score: series.sourceRating,
        ageRating: series.ageRating,
        seasonNumber: series.seasonNumber,
        episodeCount: series.episodes.length,
        genres: series.genres.map((genre) => genre.name),
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
        previewSource: resolvePreviewSource(
            series.key,
            episode,
            resume?.positionSeconds ?? null,
        ),
        description: series.synopsis,
        href: watchPath(series.key, episode.key),
        isResume: Boolean(resume),
    };
};

const HeroSection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const resumeResult = await getLatestResume();
    const resume = resumeResult.kind === "success" ? resumeResult.data : null;
    const resumedSeries = selectResumeHero(catalog, resume);

    if (resumedSeries) {
        return <HeroBanerSection lastWatchedData={heroData(resumedSeries, resume)} />;
    }

    const sections = await getHomeRowSections();
    const recommendedSeries = selectFallbackHero(
        catalog,
        sections.get("trending-today")?.items ?? [],
    );

    return (
        <HeroBanerSection
            lastWatchedData={recommendedSeries ? heroData(recommendedSeries, null) : null}
        />
    );
};

const RowSection = ({
    section,
    context,
}: {
    section: HomeSectionRow;
    context: ViewerRowContext;
}) => (
    <ContentRowSection
        title={section.title}
        numbered
        variant={section.variant}
        items={section.items.map((series) => toContentCard(series, {
            resume: context.resumeMap.get(series.key),
            inWatchlist: context.listed.has(series.key),
            allowNew: section.variant !== "ranking",
        }))}
    />
);

const RowFallback = ({ id }: { id: HomeSectionId }) => (
    <ContentRowSkeleton
        title={HOME_SECTION_PRESENTATION[id].title}
        variant={HOME_SECTION_PRESENTATION[id].variant}
        numbered
    />
);

const ContinueSection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const [continueResult, context] = await Promise.all([
        getContinueWatching(),
        getViewerRowContext(),
    ]);

    if (continueResult.kind === "error") {
        if (continueResult.reason === "unauthorized") return null;
        return <DataErrorState reason={continueResult.reason} compact />;
    }

    if (continueResult.kind === "empty") return null;

    const byKey = new Map(catalog.map((series) => [series.key, series]));
    const cards = continueResult.data
        .map((resume) => {
            const series = byKey.get(resume.seriesKey);
            return series ? toResumeCard(series, resume, context.listed.has(series.key)) : null;
        })
        .filter((card) => card !== null);

    return (
        <ContentRowSection
            title={HOME_SECTION_PRESENTATION.continue.title}
            numbered
            variant={HOME_SECTION_PRESENTATION.continue.variant}
            items={cards}
        />
    );
};

const TmdbRowSection = async ({ id }: { id: HomeSectionId }) => {
    const [sections, context] = await Promise.all([
        getHomeRowSections(),
        getViewerRowContext(),
    ]);
    const section = sections.get(id);

    if (!section) return null;

    return <RowSection section={section} context={context} />;
};

const NewestSection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const result = buildNewestHomeRow(catalog);

    if (result.kind !== "ready") return null;

    return <RowSection section={result.row} context={await getViewerRowContext()} />;
};

const WatchlistSection = async ({ catalog }: { catalog: CatalogSeries[] }) => {
    const [watchlistResult, context] = await Promise.all([
        getWatchlist(),
        getViewerRowContext(),
    ]);
    const result = buildWatchlistHomeRow(catalog, watchlistResult);

    if (result.kind !== "ready") return null;

    return <RowSection section={result.row} context={context} />;
};

const LibrarySection = async ({ catalog }: { catalog: CatalogSeries[] }) => (
    <RowSection
        section={{
            id: "library",
            ...HOME_SECTION_PRESENTATION.library,
            items: collapseSeriesGroups(catalog),
        }}
        context={await getViewerRowContext()}
    />
);

const EmptyArchive = ({ canManageLibrary }: { canManageLibrary: boolean }) => (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-start justify-center px-5 sm:px-8">
        <span className="font-mono text-[11px] tracking-[0.22em] text-nx-text-2">
            ARCHIWUM / 0 TYTUŁÓW
        </span>
        <h1 className="mt-4 max-w-[12ch] font-display text-[34px] leading-[.95] tracking-[-0.03em] text-nx-text sm:text-[44px]">
            Archiwum jest puste
        </h1>
        <p className="mt-5 max-w-[40ch] text-[15px] leading-[1.65] text-nx-text-2">
            {canManageLibrary
                ? "Uruchom transkoder, aby opublikować pierwszy tytuł wraz z odcinkami."
                : "Administrator nie opublikował jeszcze żadnych tytułów."}
        </p>
        {canManageLibrary && (
            <Link
                href="/admin/upload"
                className="mt-7 flex min-h-12 items-center rounded-full bg-nx-accent px-6 text-[15px] font-semibold text-nx-on-accent outline-none transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--nx-accent)_88%,var(--nx-text))] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
            >
                Otwórz panel mediów
            </Link>
        )}
    </div>
);

const HomeDashboard = async () => {
    const [catalogResult, user] = await Promise.all([
        getCatalog(),
        getSessionUser(),
    ]);

    if (catalogResult.kind === "error") {
        return (
            <div className="px-5 py-16 sm:px-8 xl:px-10 min-[1440px]:px-12">
                <DataErrorState reason={catalogResult.reason} headingLevel={1} />
            </div>
        );
    }

    if (catalogResult.kind === "empty") {
        return <EmptyArchive canManageLibrary={user?.role === "admin"} />;
    }

    const catalog = catalogResult.data;

    return (
        <>
            <Suspense fallback={<div className="h-[46vh] min-h-80 w-full bg-nx-panel skeleton-pulse lg:h-[52vh] lg:min-h-105 xl:h-[58vh] xl:min-h-130 min-[1440px]:h-[62vh]" />}>
                <HeroSection catalog={catalog} />
            </Suspense>

            <div className="nx-home-rows flex flex-col gap-12 px-5 py-12 sm:px-8 lg:gap-[72px] lg:py-[72px] xl:gap-[88px] xl:px-10 xl:py-[88px] min-[1440px]:gap-24 min-[1440px]:px-12 min-[1440px]:py-24">
                <Suspense fallback={<RowFallback id="continue" />}>
                    <ContinueSection catalog={catalog} />
                </Suspense>

                <Suspense fallback={<RowFallback id="trending-today" />}>
                    <TmdbRowSection id="trending-today" />
                </Suspense>

                <Suspense fallback={<RowFallback id="newest-local" />}>
                    <NewestSection catalog={catalog} />
                </Suspense>

                <Suspense fallback={<RowFallback id="popular-now" />}>
                    <TmdbRowSection id="popular-now" />
                </Suspense>

                <Suspense fallback={<RowFallback id="watchlist" />}>
                    <WatchlistSection catalog={catalog} />
                </Suspense>

                <Suspense fallback={<RowFallback id="recommendations" />}>
                    <TmdbRowSection id="recommendations" />
                </Suspense>

                <Suspense fallback={<RowFallback id="top-rated" />}>
                    <TmdbRowSection id="top-rated" />
                </Suspense>

                <Suspense fallback={<RowFallback id="on-the-air" />}>
                    <TmdbRowSection id="on-the-air" />
                </Suspense>

                <Suspense fallback={<RowFallback id="library" />}>
                    <LibrarySection catalog={catalog} />
                </Suspense>
            </div>
        </>
    );
};

export default function Home() {
    return (
        <div className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-nx-bg">
            <Suspense fallback={<div className="min-h-dvh bg-nx-bg" />}>
                <HomeDashboard />
            </Suspense>

            <Suspense fallback={null}>
                <SeriesModal />
            </Suspense>
        </div>
    );
}
