"use client";

import Image from "next/image";
import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { Info, Play, Star, Volume2, VolumeX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ARTWORK_SIZES, blurProps, imageLoader, safeArtworkColor } from "@/lib/catalog/imageDelivery";
import type { PreviewSource } from "@/lib/player/videoAccess";
import { setPreviewMuted } from "@/components/series/previewController";
import { usePreviewSurface } from "@/components/preview/usePreviewSurface";

export interface LastWatchedData {
    seriesKey: string;
    title: string;
    episodeFile: string;
    episodeNumber: number;
    lastWatchedTime: number;
    progressPercent: number | null;
    remainingMinutes: number | null;
    poster: string | null;
    backdrop: string | null;
    logo?: string | null;
    dominantColor?: string | null;
    placeholder?: string | null;
    safeLeft?: number | null;
    safeBottom?: number | null;
    focal?: { x: number; y: number };
    previewSource: PreviewSource | null;
    description: string | null;
    href: string;
    isResume: boolean;
    infoId?: number | null;
    year?: number | null;
    score?: string | null;
    ageRating?: string | null;
    seasonNumber?: number | null;
    episodeCount?: number | null;
    genres?: string[];
}

interface HeroBanerProps {
    lastWatchedData: LastWatchedData | null;
}

const HeroBanerSection = ({ lastWatchedData }: HeroBanerProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const preview = usePreviewSurface(lastWatchedData?.previewSource);
    const [isMuted, setIsMuted] = useState(true);
    const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
    const [failedLogo, setFailedLogo] = useState<string | null>(null);

    if (!lastWatchedData) return null;

    const activeContent = lastWatchedData;
    const preferredArtwork = activeContent.backdrop;
    const artwork = preferredArtwork === failedArtwork ? null : preferredArtwork;
    const safeDominantColor = safeArtworkColor(activeContent.dominantColor);
    const focal = activeContent.focal ?? { x: 0.5, y: 0.4 };
    const safeLeft = Math.min(0.9, Math.max(0.35, activeContent.safeLeft ?? 0.52));
    const safeBottom = Math.min(0.7, Math.max(0.3, activeContent.safeBottom ?? 0.42));
    const logo = activeContent.logo === failedLogo ? null : activeContent.logo;

    const metaParts = [
        activeContent.year ? String(activeContent.year) : null,
        activeContent.seasonNumber ? `Sezon ${activeContent.seasonNumber}` : null,
        activeContent.episodeCount ? `${activeContent.episodeCount} odc.` : null,
        activeContent.ageRating,
        ...(activeContent.genres ?? []).slice(0, 2),
    ].filter((part): part is string => Boolean(part));

    const openEpisode = () => router.push(activeContent.href);

    const openInfo = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (activeContent.infoId === null || activeContent.infoId === undefined) return;

        const params = new URLSearchParams(searchParams.toString());
        params.set("info", String(activeContent.infoId));
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const toggleMute = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const video = preview.videoRef.current;
        if (!video) return;

        const muted = !video.muted;
        setPreviewMuted(muted);
        setIsMuted(muted);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;

        event.preventDefault();
        openEpisode();
    };

    return (
        <section
            role="link"
            tabIndex={0}
            aria-label={`${activeContent.isResume ? "Wznów" : "Odtwórz"} ${activeContent.title}`}
            onClick={openEpisode}
            onKeyDown={handleKeyDown}
            {...preview.surfaceProps}
            className="group/hero relative h-[62vh] min-h-[440px] max-h-[560px] w-full cursor-pointer overflow-hidden border-b border-nx-border bg-nx-panel outline-none sm:h-[64vh] lg:h-[70vh] lg:min-h-[520px] lg:max-h-[680px] xl:h-[72vh] xl:max-h-[760px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-nx-accent"
            style={safeDominantColor ? {
                background: `linear-gradient(to top, var(--nx-bg), color-mix(in srgb, ${safeDominantColor} 8%, var(--nx-panel)))`,
            } : undefined}
        >
            {artwork && (
                <Image
                    src={artwork}
                    alt=""
                    fill
                    preload
                    sizes={ARTWORK_SIZES.hero}
                    loader={imageLoader(artwork, "hero")}
                    {...blurProps(activeContent.placeholder)}
                    onError={() => setFailedArtwork(artwork)}
                    className="object-cover transition-opacity duration-300 motion-reduce:transition-none"
                    style={{ objectPosition: `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%` }}
                />
            )}

            <video
                {...preview.videoProps}
                onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
                muted={isMuted}
                className={`absolute inset-0 size-full object-cover transition-opacity duration-520 motion-reduce:transition-none ${preview.isPlaying ? "opacity-100" : "opacity-0"}`}
            />

            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,var(--nx-bg)_2%,color-mix(in_srgb,var(--nx-bg)_72%,transparent)_34%,transparent_72%)]" />
            <span className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,color-mix(in_srgb,var(--nx-bg)_92%,transparent)_0%,color-mix(in_srgb,var(--nx-bg)_46%,transparent)_42%,transparent_74%)] md:block" />

            {preview.isPlaying && (
                <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Włącz dźwięk" : "Wycisz"}
                    className="absolute bottom-6 right-5 z-30 hidden size-11 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text outline-none transition-colors duration-140 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent [@media(pointer:fine)]:flex sm:right-8 xl:right-10 min-[1440px]:right-12"
                >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
            )}

            <div
                className="absolute bottom-0 left-0 z-20 flex w-full max-w-full flex-col justify-end px-5 pb-8 pt-14 sm:px-8 sm:pb-12 sm:pt-24 md:max-w-[var(--nx-hero-copy-w)] lg:px-10 lg:pb-13 xl:px-11 xl:pb-14 min-[1440px]:px-12"
                style={{
                    "--nx-hero-copy-w": `min(620px, ${Math.round(safeLeft * 100)}vw)`,
                    minHeight: `min(100%, max(320px, ${Math.round(safeBottom * 100)}vh))`,
                } as CSSProperties}
            >
                <span className="mb-4 flex w-fit items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] uppercase text-nx-accent sm:text-[10.5px]">
                    <span aria-hidden="true" className="h-px w-[18px] bg-nx-accent" />
                    {activeContent.isResume ? "Kontynuuj oglądanie" : "Dzisiejszy wybór"}
                </span>

                {logo ? (
                    <h1 className="relative block h-20 w-full max-w-[460px] drop-shadow-[0_8px_28px_rgba(0,0,0,0.7)] sm:h-24 lg:h-28 xl:h-33">
                        <Image
                            src={logo}
                            alt={activeContent.title}
                            fill
                            sizes={ARTWORK_SIZES.logo}
                            loader={imageLoader(logo, "logo")}
                            onError={() => setFailedLogo(logo)}
                            className="object-contain object-left"
                        />
                    </h1>
                ) : (
                    <h1
                        title={activeContent.title}
                        className="line-clamp-3 max-w-[16ch] text-balance font-display text-[34px] leading-none tracking-[-0.02em] text-nx-text drop-shadow-[0_8px_28px_rgba(0,0,0,0.7)] sm:text-[42px] lg:line-clamp-2 lg:text-[54px] lg:leading-[.92] lg:tracking-[-0.035em] xl:text-[64px] xl:leading-[.89]"
                    >
                        {activeContent.title}
                    </h1>
                )}

                {(metaParts.length > 0 || activeContent.score) && (
                    <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-2 font-mono text-[10.5px] tracking-[0.1em] text-nx-text-2 sm:text-[11px]">
                        {activeContent.score && (
                            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--nx-accent-2)_32%,transparent)] bg-[color-mix(in_srgb,var(--nx-bg)_72%,transparent)] px-2.5 py-1 text-nx-accent-2 backdrop-blur-sm">
                                <Star size={11} fill="currentColor" aria-hidden="true" />
                                <span>{activeContent.score}</span>
                                <span className="sr-only">ocena</span>
                            </span>
                        )}
                        {metaParts.map((part, index) => (
                            <span key={`${part}-${index}`} className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
                                {index > 0 && <span aria-hidden="true" className="text-nx-border">·</span>}
                                {part}
                            </span>
                        ))}
                    </div>
                )}

                {activeContent.description && (
                    <p className="mt-4 line-clamp-2 max-w-[52ch] text-[15px] leading-[1.62] text-[color-mix(in_srgb,var(--nx-text)_82%,transparent)] [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] lg:text-[15.5px]">
                        {activeContent.description}
                    </p>
                )}

                {activeContent.progressPercent !== null && (
                    <div className="mt-6 flex max-w-[380px] items-center gap-3.5">
                        <span
                            role="progressbar"
                            aria-label={`Postęp odcinka ${activeContent.episodeNumber}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={activeContent.progressPercent}
                            className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--nx-text)_18%,transparent)]"
                        >
                            <span
                                className="absolute inset-y-0 left-0 rounded-full bg-nx-accent"
                                style={{ width: `${activeContent.progressPercent}%` }}
                            />
                        </span>
                        {activeContent.remainingMinutes !== null && activeContent.remainingMinutes !== undefined && (
                            <span className="shrink-0 font-mono text-[10.5px] tracking-[0.1em] text-nx-text-2">
                                Pozostało {activeContent.remainingMinutes} min
                            </span>
                        )}
                    </div>
                )}

                <div className="mt-6 flex items-center gap-2.5 sm:mt-7 sm:gap-3">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            openEpisode();
                        }}
                        className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-full bg-nx-accent px-5 text-[15px] font-semibold text-nx-on-accent outline-none transition-[transform,background-color] duration-140 hover:bg-[color-mix(in_srgb,var(--nx-accent)_86%,var(--nx-text))] active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent motion-reduce:transition-none sm:flex-none sm:px-6"
                    >
                        <Play size={17} fill="currentColor" />
                        {activeContent.isResume
                            ? `Wznów odcinek ${activeContent.episodeNumber}`
                            : `Odtwórz odcinek ${activeContent.episodeNumber}`}
                    </button>

                    {activeContent.infoId !== null && activeContent.infoId !== undefined && (
                        <button
                            type="button"
                            onClick={openInfo}
                            aria-label={`Informacje o ${activeContent.title}`}
                            className="flex size-12 shrink-0 items-center justify-center gap-2.5 rounded-full border border-nx-border bg-[color-mix(in_srgb,var(--nx-panel)_74%,transparent)] text-[15px] font-semibold text-nx-text outline-none backdrop-blur-md transition-colors duration-140 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent sm:w-auto sm:px-6"
                        >
                            <Info size={18} aria-hidden="true" />
                            <span className="hidden sm:inline">Informacje</span>
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
};

export default HeroBanerSection;
