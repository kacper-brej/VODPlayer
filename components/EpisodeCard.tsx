"use client"
import { useRef, useState } from "react"
import { Play, Settings, ChevronsLeft, ChevronsRight, FileVideo, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { WATCHED_THRESHOLD_PERCENT } from "@/lib/watchProgress";

export interface EpisodeProps {
    id: number | string;
    seriesId: number | string;
    episodeNumber: number;
    title: string;
    duration: number | string;
    description: string;
    thumbnail: string;
    videoUrl?: string;
    progress?: number;
}

const RATE_STEP = 0.25;
const RATE_MIN = 0.25;
const RATE_MAX = 2;

const EpisodeCard = ({ seriesId, episodeNumber, thumbnail, videoUrl, progress }: EpisodeProps) => {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const isWatched = progress !== undefined && progress >= WATCHED_THRESHOLD_PERCENT;

    const goToEpisode = () => router.push(`/watch?id=${seriesId}&ep=${episodeNumber}`);

    const applyRate = (rate: number) => {
        setPlaybackRate(rate);
        if (videoRef.current) videoRef.current.playbackRate = rate;
    };

    const adjustRate = (e: React.MouseEvent, delta: number) => {
        e.stopPropagation();
        applyRate(Math.min(RATE_MAX, Math.max(RATE_MIN, Number((playbackRate + delta).toFixed(2)))));
    };

    const resetRate = (e: React.MouseEvent) => {
        e.stopPropagation();
        applyRate(1);
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <div
                onClick={goToEpisode}
                className={`group relative aspect-video w-full rounded-lg md:rounded-xl overflow-hidden bg-surface border border-white/5 hover:border-border-hover cursor-pointer transition-colors ${isWatched ? 'ring-2 ring-success/50' : ''}`}
            >
                {videoUrl ? (
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        poster={thumbnail}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/20 pointer-events-none" />

                {isWatched && (
                    <span className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[9px] md:text-[10px] font-semibold text-success bg-success/20 backdrop-blur-md border border-success/40 rounded-full px-2 py-0.5">
                        <CheckCircle2 size={10} />
                        Obejrzane
                    </span>
                )}

                <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 flex items-center gap-1 z-10">
                    <button
                        onClick={resetRate}
                        aria-label="Resetuj prędkość"
                        className="w-6 h-6 flex items-center justify-center rounded-md bg-black/60 backdrop-blur-sm text-foreground/80 hover:text-foreground hover:bg-black/80 transition-colors cursor-pointer"
                    >
                        <Settings size={12} />
                    </button>
                    <div className="flex items-center rounded-md bg-black/60 backdrop-blur-sm overflow-hidden">
                        <button
                            onClick={(e) => adjustRate(e, -RATE_STEP)}
                            aria-label="Zmniejsz prędkość"
                            className="p-1 text-foreground/80 hover:text-foreground hover:bg-black/40 transition-colors cursor-pointer"
                        >
                            <ChevronsLeft size={12} />
                        </button>
                        <span className="px-1 text-[10px] font-semibold text-foreground tabular-nums select-none">
                            {playbackRate.toFixed(2)}
                        </span>
                        <button
                            onClick={(e) => adjustRate(e, RATE_STEP)}
                            aria-label="Zwiększ prędkość"
                            className="p-1 text-foreground/80 hover:text-foreground hover:bg-black/40 transition-colors cursor-pointer"
                        >
                            <ChevronsRight size={12} />
                        </button>
                    </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-11 h-11 md:w-14 md:h-14 flex items-center justify-center rounded-full border-2 backdrop-blur-sm transition-all group-hover:scale-105 ${isWatched ? 'border-success/70 bg-success/10 text-success' : 'border-foreground/70 bg-black/25 text-foreground group-hover:bg-primary/40 group-hover:border-primary'}`}>
                        <Play size={18} className="fill-current ml-0.5 md:w-5 md:h-5" />
                    </div>
                </div>

                {progress !== undefined && progress > 0 && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-10">
                        <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-0.5 px-0.5">
                <span className="text-sm md:text-base font-bold text-foreground">
                    {episodeNumber}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] md:text-xs uppercase tracking-wide text-muted font-semibold">
                    <FileVideo size={12} />
                    Wideo MP4
                </span>
            </div>
        </div>
    )
}

export default EpisodeCard;
