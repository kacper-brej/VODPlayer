"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Clock, Play, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { ARTWORK_SIZES, blurProps, imageLoader, safeArtworkColor } from "@/lib/imageDelivery";
import { cancelPreview, claimPreviewSlot } from "@/components/series/previewController";

export interface LastWatchedData {
    seriesKey: string;
    title: string;
    episodeFile: string;
    episodeNumber: number;
    lastWatchedTime: number;
    progressPercent: number | null;
    poster: string | null;
    backdrop: string | null;
    logo?: string | null;
    dominantColor?: string | null;
    placeholder?: string | null;
    safeLeft?: number | null;
    safeBottom?: number | null;
    focal?: { x: number; y: number };
    video: string;
    description: string | null;
    href: string;
    isResume: boolean;
}

interface HeroBanerProps {
    lastWatchedData: LastWatchedData | null;
}

const HOVER_INTENT_MS = 900;
const PREVIEW_START_SECONDS = 2;
const PREVIEW_DURATION_SECONDS = 8;

const HeroBanerSection = ({ lastWatchedData }: HeroBanerProps) => {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previewStartRef = useRef(PREVIEW_START_SECONDS);
    const previewTokenRef = useRef(Symbol("hero-preview"));
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
    const [failedLogo, setFailedLogo] = useState<string | null>(null);

    useEffect(() => {
        const previewToken = previewTokenRef.current;

        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            cancelPreview(previewToken);
        };
    }, []);

    if (!lastWatchedData) return null;

    const activeContent = lastWatchedData;
    const preferredArtwork = activeContent.backdrop;
    const artwork = preferredArtwork === failedArtwork ? null : preferredArtwork;
    const safeDominantColor = safeArtworkColor(activeContent.dominantColor);
    const focal = activeContent.focal ?? { x: 0.5, y: 0.4 };
    const safeLeft = Math.min(0.9, Math.max(0.35, activeContent.safeLeft ?? 0.52));
    const safeBottom = Math.min(0.7, Math.max(0.3, activeContent.safeBottom ?? 0.42));
    const logo = activeContent.logo === failedLogo ? null : activeContent.logo;

    const openEpisode = () => router.push(activeContent.href);

    const startPreview = () => {
        const connection = (navigator as Navigator & {
            connection?: {
                saveData?: boolean;
                effectiveType?: string;
                downlink?: number;
            };
        }).connection;
        const effectiveType = connection?.effectiveType?.toLowerCase();
        const slowConnection = effectiveType === "slow-2g"
            || effectiveType === "2g"
            || effectiveType === "3g"
            || (typeof connection?.downlink === "number" && connection.downlink < 5);

        const video = videoRef.current;

        if (
            !video
            || connection?.saveData
            || slowConnection
            || window.matchMedia("(hover: none)").matches
            || window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return;
        }

        claimPreviewSlot(previewTokenRef.current, video);

        setIsMuted(true);
        setIsPlaying(false);
        video.muted = true;
        video.src = activeContent.video;
        video.load();
    };

    const handleHover = () => {
        if (!activeContent.video) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => {
            hoverTimerRef.current = null;
            startPreview();
        }, HOVER_INTENT_MS);
    };

    const stopPreview = () => {
        cancelPreview(previewTokenRef.current);
        setIsPlaying(false);
        setIsMuted(true);
    };

    const handleHoverEnd = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }

        stopPreview();
    };

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;

        const latestSafeStart = Math.max(0, video.duration - PREVIEW_DURATION_SECONDS - 1);
        const previewStart = Math.min(PREVIEW_START_SECONDS, latestSafeStart);
        previewStartRef.current = previewStart;
        video.currentTime = previewStart;

        video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => setIsPlaying(false));
        });
    };

    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video || video.currentTime < previewStartRef.current + PREVIEW_DURATION_SECONDS) return;
        stopPreview();
    };

    const toggleMute = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const video = videoRef.current;
        if (!video) return;

        video.muted = !video.muted;
        setIsMuted(video.muted);
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
            onMouseEnter={handleHover}
            onMouseLeave={handleHoverEnd}
            className="group/hero relative h-[46vh] min-h-80 max-h-105 w-full cursor-pointer overflow-hidden border-y border-nx-border bg-nx-panel outline-none lg:h-[52vh] lg:min-h-105 lg:max-h-155 xl:h-[58vh] xl:min-h-130 xl:max-h-190 min-[1440px]:h-[62vh] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-nx-accent"
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
                ref={videoRef}
                onLoadedMetadata={handleLoadedMetadata}
                onPlaying={() => setIsPlaying(true)}
                onTimeUpdate={handleTimeUpdate}
                onError={stopPreview}
                muted={isMuted}
                playsInline
                preload="none"
                className={`absolute inset-0 size-full object-cover transition-opacity duration-520 motion-reduce:transition-none ${isPlaying ? "opacity-100" : "opacity-0"}`}
            />

            <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-nx-bg via-nx-bg/15 to-transparent md:bg-[linear-gradient(90deg,var(--nx-bg)_0%,color-mix(in_srgb,var(--nx-bg)_88%,transparent)_34%,color-mix(in_srgb,var(--nx-bg)_20%,transparent)_64%,color-mix(in_srgb,var(--nx-bg)_55%,transparent)_100%)]" />
            <span className="pointer-events-none absolute inset-0 hidden bg-linear-to-t from-nx-bg via-transparent to-transparent md:block" />

            {isPlaying && (
                <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Włącz dźwięk" : "Wycisz"}
                    className="absolute bottom-6 right-5 z-30 hidden size-11 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text outline-none transition-colors duration-140 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent [@media(pointer:fine)]:flex sm:right-8 xl:right-10 min-[1440px]:right-12"
                >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
            )}

            <div
                className="absolute bottom-0 left-0 z-20 flex w-full max-w-[760px] flex-col justify-end px-5 pb-6 pt-20 sm:px-8 sm:pb-10 lg:px-8 lg:pb-12 xl:px-10 xl:pb-14 min-[1440px]:px-12"
                style={{
                    maxWidth: `min(760px, ${Math.round(safeLeft * 100)}vw)`,
                    minHeight: `min(100%, max(320px, ${Math.round(safeBottom * 100)}vh))`,
                }}
            >
                <span className="mb-3 flex w-fit items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-nx-text-2 sm:text-[11px]">
                    {activeContent.isResume && <Clock size={14} className="text-nx-accent" />}
                    {activeContent.isResume ? "KONTYNUUJ OGLĄDANIE" : "DZISIEJSZY WYBÓR"}
                </span>

                {logo ? (
                    <span className="relative block h-20 w-full max-w-[520px] sm:h-24 lg:h-30">
                        <Image
                            src={logo}
                            alt={activeContent.title}
                            fill
                            sizes={ARTWORK_SIZES.logo}
                            loader={imageLoader(logo, "logo")}
                            onError={() => setFailedLogo(logo)}
                            className="object-contain object-left"
                        />
                    </span>
                ) : (
                    <h1
                        title={activeContent.title}
                        className="line-clamp-3 max-w-[16ch] text-balance font-display text-[34px] leading-none tracking-[-0.02em] text-nx-text sm:text-[42px] lg:line-clamp-2 lg:text-[54px] lg:leading-[.92] lg:tracking-[-0.035em] xl:text-[66px] xl:leading-[.89] min-[1440px]:text-[76px] min-[1440px]:leading-[.88]"
                    >
                        {activeContent.title}
                    </h1>
                )}

                {activeContent.description && (
                    <p className="mt-4 line-clamp-3 max-w-[46ch] text-[15px] leading-[1.65] text-nx-text-2 lg:line-clamp-4 lg:text-[15.5px] lg:leading-[1.68] xl:text-base xl:leading-[1.7]">
                        {activeContent.description}
                    </p>
                )}

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        openEpisode();
                    }}
                    className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-nx-accent px-6 text-[15px] font-semibold text-nx-on-accent outline-none transition-[transform,background-color] duration-140 hover:bg-[color-mix(in_srgb,var(--nx-accent)_88%,var(--nx-text))] active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent motion-reduce:transition-none sm:w-fit"
                >
                    <Play size={18} fill="currentColor" />
                    {activeContent.isResume
                        ? `Wznów odcinek ${activeContent.episodeNumber}`
                        : `Odtwórz odcinek ${activeContent.episodeNumber}`}
                </button>
            </div>

            {activeContent.progressPercent !== null && (
                <span className="absolute inset-x-0 bottom-0 z-30 h-0.5 bg-nx-border">
                    <span
                        className="block h-full bg-nx-accent"
                        style={{ width: `${activeContent.progressPercent}%` }}
                    />
                </span>
            )}
        </section>
    );
};

export default HeroBanerSection;
