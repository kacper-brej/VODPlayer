"use client";
import { Play, Download, MoreHorizontal, Clock, Volume2, VolumeX } from "lucide-react";
import { useState, useRef, useEffect, KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { hasPageInteraction } from "@/lib/pageInteraction";
import { watchPath } from "@/lib/routes";

export interface LastWatchedData {
    seriesId: number;
    title: string;
    episodeFile: string;
    progressPercent: number;
    lastWatchedTime: number;
    image: string;
    video: string;
    description: string;
    tags: string[];
}

interface HeroBanerProps {
    lastWatchedData: LastWatchedData | null;
}

const HeroBanerSection = ({ lastWatchedData }: HeroBanerProps) => {

    const router = useRouter();
    const activeContent = lastWatchedData;
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [videoSource, setVideoSource] = useState<string | undefined>();
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isMuted, setIsMuted] = useState<boolean>(true);

    const handleHover = () => {
        if (!activeContent || typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
            return;
        }
        hoverTimeout.current = setTimeout(() => {
            setIsMuted(!hasPageInteraction());
            setVideoSource(activeContent.video);
            setIsPlaying(true);
        }, 250);
    }

    const handleHoverEnd = () => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setIsPlaying(false);
        setIsMuted(true);
        const video = videoRef.current;
        if (!video) return;
        video.pause();
        if (videoSource && activeContent) {
            video.currentTime = Math.max(0, activeContent.lastWatchedTime - 10);
        }
    }

    useEffect(() => {
        if (!isPlaying || !videoSource || !activeContent || !videoRef.current) return;

        const video = videoRef.current;
        video.currentTime = Math.max(0, activeContent.lastWatchedTime - 10);
        video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
        });
    }, [activeContent, isPlaying, videoSource]);

    useEffect(() => {
        return () => {
            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        };
    }, []);

    const toggleMute = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const openEpisode = () => {
        if (!activeContent) return;
        router.push(watchPath(activeContent.seriesId, activeContent.episodeFile));
    };

    const handlePlayClick = (event: MouseEvent) => {
        event.stopPropagation();
        openEpisode();
    };

    const handleHeroKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;

        event.preventDefault();
        openEpisode();
    };

    if (!activeContent) {
        return (
            <div className="m-auto mt-15 flex h-[50vh] w-[85%] items-end overflow-hidden rounded-3xl border border-white/5 bg-surface p-5 shadow-2xl md:h-[60vh] md:p-10">
                <div className="max-w-xl">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nocturna</span>
                    <h1 className="mt-3 text-2xl max-sm:font-bold text-foreground sm:font-display sm:text-3xl md:text-5xl">
                        Wybierz coś na wieczór
                    </h1>
                    <p className="mt-3 text-sm text-muted md:text-base">
                        Rozpoczęty tytuł pojawi się tutaj, aby można było łatwo wrócić do oglądania.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={openEpisode}
            onKeyDown={handleHeroKeyDown}
            onMouseEnter={handleHover}
            onMouseLeave={handleHoverEnd}
            role="link"
            tabIndex={0}
            className={`rounded-3xl shadow-2xl m-auto mt-15 relative bg-surface w-[85%] border border-white/5 h-[50vh] md:h-[60vh] overflow-hidden group  
            duration-700 cursor-pointer hover:scale-105 hover:shadow-[0_0_50px_var(--primary)]`}
        >
            <video
                ref={videoRef}
                src={videoSource}
                poster={activeContent.image}
                muted={isMuted}
                loop
                playsInline
                preload="none"
                className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
            />

            <div className="absolute inset-x-0 bg-linear-to-t from-background/95 via-background/40 to-transparent md:bg-linear-to-r md:from-background md:via-background/80 md:to-transparent z-10 pointer-events-none"/>
            <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent opacity-100 md:opacity-80 z-10 pointer-events-none"/>

            {isPlaying && (
                <button
                    onClick={toggleMute}
                    className="absolute cursor-pointer bottom-6 right-6 z-40 max-md:hidden md:flex items-center justify-center w-10 h-10 bg-surface/50 hover:bg-surface/80 backdrop-blur-md border border-white/10 rounded-full text-foreground transition-all duration-300 active:scale-95"
                >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
            )}

            <div className="absolute inset-0 p-5 md:p-10 flex flex-col justify-end w-full md:max-w-3xl z-20 pointer-events-none">
                {lastWatchedData && (
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur border border-white/5 rounded-full px-3 py-1.5 w-fit mb-3 md:mb-4">
                        <Clock size={14} className='text-primary' />
                        <span className="text-xs font-medium text-foreground">Kontynuuj Oglądanie</span>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-2 md:mb-3">
                    {activeContent.tags.map((tag, idx) => (
                        <span key={idx} className="text-[0.625rem] md:text-xs font-medium px-2.5 py-1 bg-surface/50 backdrop-blur-md border border-white/5 rounded-full text-foreground/80">
                            {tag}
                        </span>
                    ))}
                </div>

                <h1 className="mb-2 text-balance text-2xl max-sm:font-bold leading-tight text-foreground sm:font-display sm:text-3xl md:mb-3 md:text-5xl">
                    {activeContent.title}
                </h1>

                <p className="text-xs md:text-base text-muted line-clamp-2 md:line-clamp-3 mb-6 md:mb-8 max-w-xl">
                    {activeContent.description}
                </p>

                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto z-30 pointer-events-auto">
                    <button
                        onClick={handlePlayClick}
                        className='flex-1 md:flex-none min-w-0 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-foreground font-semibold cursor-pointer py-2.5 md:py-3 px-4 sm:px-6 rounded-3xl transition-all duration-300 active:scale-95'
                    >
                        <Play size={18} fill='currentColor' className='shrink-0 md:w-5 md:h-5'/>
                        <span className="min-w-0 text-xs sm:text-sm md:text-base leading-snug break-words md:whitespace-nowrap">
                            Wznów {activeContent.episodeFile.replace('.mp4', '')}
                        </span>
                    </button>

                    <button
                        onClick={(event) => event.stopPropagation()}
                        className='flex items-center cursor-pointer justify-center bg-surface/50 hover:bg-white/10 border border-white/10 text-foreground w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all duration-300 backdrop-blur-md shrink-0 active:scale-95'
                    >
                        <Download size={18} className="md:w-5 md:h-5" />
                    </button>

                    <button
                        onClick={(event) => event.stopPropagation()}
                        className='flex items-center justify-center cursor-pointer bg-surface/50 hover:bg-white/10 border border-white/10 text-foreground w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all backdrop-blur-md shrink-0 active:scale-95'
                    >
                        <MoreHorizontal size={18} className="md:w-5 md:h-5" />
                    </button>
                </div>
            </div>

            {lastWatchedData && (
                <div className="absolute bottom-0 left-0 w-full h-1 md:h-1.5 bg-surface/50 z-30 pointer-events-none">
                    <div
                        className="h-full bg-primary glow-primary rounded-r-full transition-all duration-1000"
                        style={{ width: `${activeContent.progressPercent}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default HeroBanerSection;
