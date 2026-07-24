"use client"
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Play, Plus, ThumbsUp, ChevronDown } from "lucide-react";
import { hasPageInteraction } from "@/lib/pageInteraction";

export interface SeriesCardProps {
    id: number;
    title: string;
    coverImage: string;
    rating?: string;
    year?: number;
    previewVideoUrl?: string;
    watchedSeconds?: number;
}

const THUMBNAIL_FRAME_SECONDS = 2;

const SeriesCard = ({ id, title, coverImage, rating = "16+", year, previewVideoUrl, watchedSeconds }: SeriesCardProps) => {

    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hasLoadedRef = useRef(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progressPercent, setProgressPercent] = useState<number | null>(null);

    const handleCardClick = () => {
        router.push(`/series/${id}`);
    }

    const handleInfoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`?info=${id}`, {scroll: false});
    }
    const handleAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('building');
        // zrob ta funkcje pozniej
    }

    const handleLoadedMetadata = () => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = THUMBNAIL_FRAME_SECONDS;

        if (watchedSeconds) {
            setProgressPercent(Math.min(100, (watchedSeconds / videoRef.current.duration) * 100));
        }
    };

    const loadVideoIfNeeded = () => {
        if (!previewVideoUrl || !videoRef.current || hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        videoRef.current.src = previewVideoUrl;
        videoRef.current.load();
    };

    useEffect(() => {
        if (watchedSeconds !== undefined) {
            loadVideoIfNeeded();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMouseEnter = () => {
        if (!previewVideoUrl || !videoRef.current) return;

        loadVideoIfNeeded();
        videoRef.current.muted = !hasPageInteraction();
        setIsPlaying(true);

        videoRef.current.play().catch(() => {
            if (videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current.play().catch(() => {});
            }
        });
    };

    const handleMouseLeave = () => {
        if (!videoRef.current) return;
        videoRef.current.pause();
        videoRef.current.currentTime = THUMBNAIL_FRAME_SECONDS;
        setIsPlaying(false);
    };

    return (
        <div
            onClick={handleCardClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className='relative w-full h-full cursor-pointer bg-surface group'
        >
            {previewVideoUrl ? (
                <video
                    ref={videoRef}
                    poster={coverImage}
                    onLoadedMetadata={handleLoadedMetadata}
                    muted
                    loop
                    playsInline
                    preload="none"
                    className={`w-full h-full object-cover transition-transform duration-300 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                />
            ) : (
                <Image
                    src={coverImage}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 70vw, 22vw"
                />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 md:p-4">

                <h3 className="text-foreground font-bold text-sm md:text-base leading-tight drop-shadow-md line-clamp-1 mb-3">
                    {title}
                </h3>

                <div className="flex items-center justify-between w-full mb-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/watch?id=${id}&ep=1`); }}
                            className="w-7 h-7 md:w-9 md:h-9 bg-foreground cursor-pointer rounded-full flex items-center justify-center hover:bg-foreground/80 transition-colors"
                        >
                            <Play size={16} className="fill-background text-background ml-0.5" />
                        </button>

                        <button
                            onClick={handleAction}
                            className="w-7 h-7 md:w-9 md:h-9 border-2 cursor-pointer border-muted rounded-full flex items-center justify-center hover:border-foreground
                            bg-surface/50 hover:bg-surface-light transition-all text-foreground"
                        >
                            <Plus size={16} />
                        </button>

                        <button
                            onClick={handleAction}
                            className="w-7 h-7 md:w-9 md:h-9 border-2 cursor-pointer border-muted rounded-full flex items-center justify-center hover:border-foreground bg-surface/50
                            hover:bg-surface-light transition-all text-foreground"
                        >
                            <ThumbsUp size={14} />
                        </button>
                    </div>

                    <button
                        onClick={handleInfoClick}
                        className="w-7 h-7 md:w-9 md:h-9 border-2 cursor-pointer border-muted rounded-full flex items-center justify-center hover:border-foreground
                        bg-surface/50 hover:bg-surface-light transition-all text-foreground"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-foreground font-medium mb-1.5">
                    <span className="border border-muted/50 px-1 py-0.5 text-foreground/80">
                        {rating === "NR" ? "16+" : rating}
                    </span>
                    {year && (
                        <span className="text-muted">
                            {year}
                        </span>
                    )}
                    <span className="border border-muted/50 px-1 py-0.5 text-foreground/80 text-[8px] md:text-[10px] rounded-sm font-bold">
                        HD
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] md:text-[11px] text-muted font-medium line-clamp-1">
                    <span>Anime</span>
                    <span className="w-1 h-1 bg-muted rounded-full"></span>
                    <span>Akcja</span>
                    <span className="w-1 h-1 bg-muted rounded-full"></span>
                    <span>Dramat</span>
                </div>
            </div>

            {progressPercent !== null && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-background/50 z-10">
                    <div className="h-full bg-primary" style={{ width: `${progressPercent}%` }} />
                </div>
            )}
        </div>
    );
};

export default SeriesCard;
