"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Clock, Play, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { hasPageInteraction } from "@/lib/pageInteraction";

export interface LastWatchedData {
    seriesKey: string;
    title: string;
    episodeFile: string;
    episodeNumber: number;
    lastWatchedTime: number;
    progressPercent: number | null;
    poster: string | null;
    backdrop: string | null;
    dominantColor?: string | null;
    focal?: { x: number; y: number };
    video: string;
    description: string | null;
    href: string;
    isResume: boolean;
}

interface HeroBanerProps {
    lastWatchedData: LastWatchedData | null;
}

const HOVER_INTENT_MS = 400;

const HeroBanerSection = ({ lastWatchedData }: HeroBanerProps) => {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [videoSource, setVideoSource] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [failedArtwork, setFailedArtwork] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;

        if (!videoSource || !video) return;

        video.load();
        video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => setIsPlaying(false));
        });
    }, [videoSource]);

    if (!lastWatchedData) return null;

    const activeContent = lastWatchedData;
    const preferredArtwork = activeContent.backdrop ?? activeContent.poster;
    const artwork = preferredArtwork === failedArtwork ? null : preferredArtwork;
    const usesPosterFallback = artwork === activeContent.poster && !activeContent.backdrop;
    const safeDominantColor = activeContent.dominantColor
        && /^#[0-9a-f]{6}$/i.test(activeContent.dominantColor)
        ? activeContent.dominantColor
        : null;
    const focal = activeContent.focal ?? { x: 0.5, y: 0.4 };

    const openEpisode = () => router.push(activeContent.href);

    const startPreview = () => {
        const connection = (navigator as Navigator & {
            connection?: { saveData?: boolean };
        }).connection;

        if (
            connection?.saveData
            || window.matchMedia("(hover: none)").matches
            || window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return;
        }

        setIsMuted(!hasPageInteraction());
        setVideoSource(activeContent.video);
        setIsPlaying(true);
    };

    const handleHover = () => {
        if (!activeContent.video) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(startPreview, HOVER_INTENT_MS);
    };

    const handleHoverEnd = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }

        const video = videoRef.current;

        if (video) {
            video.pause();
            video.currentTime = activeContent.isResume
                ? Math.max(0, activeContent.lastWatchedTime - 10)
                : 2;
        }

        setIsPlaying(false);
        setIsMuted(true);
        setVideoSource(null);
    };

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;

        video.currentTime = activeContent.isResume
            ? Math.max(0, activeContent.lastWatchedTime - 10)
            : Math.min(2, Math.max(0, video.duration - 1));

        video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => setIsPlaying(false));
        });
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
            {artwork && usesPosterFallback && (
                <>
                    <Image
                        src={artwork}
                        alt=""
                        fill
                        preload
                        sizes="(max-width: 390px) 100vw, (max-width: 1024px) 944px, (max-width: 1280px) 1188px, 1348px"
                        onError={() => setFailedArtwork(artwork)}
                        className="scale-110 object-cover brightness-[.55] blur-3xl"
                    />
                    <span className="absolute inset-y-[8%] right-[4%] w-[46%] max-sm:right-0 max-sm:w-[58%]">
                        <Image
                            src={artwork}
                            alt={activeContent.title}
                            fill
                            sizes="(max-width: 639px) 58vw, 46vw"
                            onError={() => setFailedArtwork(artwork)}
                            className="object-contain object-right"
                        />
                        <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--nx-text)_9%,transparent)]" />
                    </span>
                </>
            )}

            {artwork && !usesPosterFallback && (
                <Image
                    src={artwork}
                    alt=""
                    fill
                    preload
                    sizes="(max-width: 390px) 100vw, (max-width: 1024px) 944px, (max-width: 1280px) 1188px, 1348px"
                    onError={() => setFailedArtwork(artwork)}
                    className="object-cover"
                    style={{ objectPosition: `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%` }}
                />
            )}

            {videoSource && (
                <video
                    ref={videoRef}
                    src={videoSource}
                    onLoadedMetadata={handleLoadedMetadata}
                    muted={isMuted}
                    loop
                    playsInline
                    preload="none"
                    className={`absolute inset-0 size-full object-cover transition-opacity duration-520 motion-reduce:transition-none ${isPlaying ? "opacity-100" : "opacity-0"}`}
                />
            )}

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

            <div className="absolute inset-0 z-20 flex max-w-[760px] flex-col justify-end px-5 pb-6 pt-20 sm:px-8 sm:pb-10 lg:px-8 lg:pb-12 xl:px-10 xl:pb-14 min-[1440px]:px-12">
                <span className="mb-3 flex w-fit items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-nx-text-2 sm:text-[11px]">
                    {activeContent.isResume && <Clock size={14} className="text-nx-accent" />}
                    {activeContent.isResume ? "KONTYNUUJ OGLĄDANIE" : "DZISIEJSZY WYBÓR"}
                </span>

                <h1
                    title={activeContent.title}
                    className="line-clamp-3 max-w-[16ch] text-balance font-display text-[34px] leading-none tracking-[-0.02em] text-nx-text sm:text-[42px] lg:line-clamp-2 lg:text-[54px] lg:leading-[.92] lg:tracking-[-0.035em] xl:text-[66px] xl:leading-[.89] min-[1440px]:text-[76px] min-[1440px]:leading-[.88]"
                >
                    {activeContent.title}
                </h1>

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
