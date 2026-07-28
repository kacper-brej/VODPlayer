"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Plus, Check, ThumbsUp, ChevronDown } from "lucide-react";
import { hasPageInteraction } from "@/lib/pageInteraction";
import { progressPercent } from "@/lib/watchProgress";
import { watchPath } from "@/lib/routes";
import toggleWatchlistAction from "@/lib/toggleWatchlistAction";

export interface SeriesCardProps {
    id: number;
    title: string;
    coverImage: string;
    rating?: string;
    year?: number;
    previewVideoUrl?: string;
    resumeEpisodeKey?: string;
    watchedSeconds?: number;
    durationSeconds?: number;
    eagerPreview?: boolean;
    previewStartSeconds?: number;
    seriesKey?: string;
    inWatchlist?: boolean;
}

const WATCHLIST_ERROR_DISPLAY_MS = 2500;

const HOVER_INTENT_MS = 80;
const NEAR_VIEWPORT_MARGIN = "300px";
const DEFAULT_PREVIEW_START_SECONDS = 2;

const SeriesCard = ({
    id,
    title,
    coverImage,
    rating = "16+",
    year,
    previewVideoUrl,
    resumeEpisodeKey,
    watchedSeconds,
    durationSeconds,
    eagerPreview = false,
    previewStartSeconds = DEFAULT_PREVIEW_START_SECONDS,
    seriesKey,
    inWatchlist = false,
}: SeriesCardProps) => {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasSourceRef = useRef(false);
    const watchlistErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isNearViewport, setIsNearViewport] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [watchlisted, setWatchlisted] = useState(inWatchlist);
    const [syncedInWatchlist, setSyncedInWatchlist] = useState(inWatchlist);
    const [watchlistError, setWatchlistError] = useState<string | null>(null);

    if (inWatchlist !== syncedInWatchlist) {
        setSyncedInWatchlist(inWatchlist);
        setWatchlisted(inWatchlist);
    }

    useEffect(() => {
        return () => {
            if (watchlistErrorTimerRef.current) clearTimeout(watchlistErrorTimerRef.current);
        };
    }, []);

    const percent = watchedSeconds ? progressPercent(watchedSeconds, durationSeconds) : null;

    const attachSource = useCallback(() => {
        const video = videoRef.current;

        if (!video || !previewVideoUrl || hasSourceRef.current) return;

        hasSourceRef.current = true;
        video.src = previewVideoUrl;
    }, [previewVideoUrl]);

    useEffect(() => {
        const node = containerRef.current;

        if (!node || !previewVideoUrl || typeof IntersectionObserver === "undefined") return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setIsNearViewport(true);
                    observer.disconnect();
                }
            },
            { rootMargin: NEAR_VIEWPORT_MARGIN },
        );

        observer.observe(node);

        return () => observer.disconnect();
    }, [previewVideoUrl]);

    useEffect(() => {
        if (isNearViewport && eagerPreview) attachSource();
    }, [isNearViewport, eagerPreview, attachSource]);

    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, []);

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;

        if (video.currentTime < previewStartSeconds && video.duration > previewStartSeconds) {
            video.currentTime = previewStartSeconds;
        }
    };

    const startPreview = () => {
        const video = videoRef.current;

        if (!video || !previewVideoUrl) return;

        attachSource();
        video.muted = !hasPageInteraction();
        setIsPlaying(true);

        video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
        });
    };

    const handlePointerEnter = (event: React.PointerEvent) => {
        if (event.pointerType !== "mouse" || !previewVideoUrl) return;

        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(startPreview, HOVER_INTENT_MS);
    };

    const handlePointerLeave = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }

        const video = videoRef.current;
        if (!video) return;

        video.pause();
        if (hasSourceRef.current) video.currentTime = previewStartSeconds;
        setIsPlaying(false);
    };

    const handleCardClick = () => {
        router.push(watchPath(id, resumeEpisodeKey));
    };

    const handleInfoClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        router.push(`?info=${id}`, { scroll: false });
    };

    const handlePlayFromStart = (event: React.MouseEvent) => {
        event.stopPropagation();
        router.push(watchPath(id, 1));
    };

    const handleAction = (event: React.MouseEvent) => {
        event.stopPropagation();
    };

    const handleToggleWatchlist = (event: React.MouseEvent) => {
        event.stopPropagation();

        if (!seriesKey) return;

        const nextState = !watchlisted;
        setWatchlisted(nextState);
        setWatchlistError(null);

        void toggleWatchlistAction({ seriesKey, inWatchlist: nextState }).then((result) => {
            if (result.success) return;

            setWatchlisted(!nextState);
            setWatchlistError("Nie udało się zapisać listy.");

            if (watchlistErrorTimerRef.current) clearTimeout(watchlistErrorTimerRef.current);
            watchlistErrorTimerRef.current = setTimeout(
                () => setWatchlistError(null),
                WATCHLIST_ERROR_DISPLAY_MS,
            );
        });
    };

    return (
        <div
            ref={containerRef}
            onClick={handleCardClick}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            className="relative w-full h-full cursor-pointer bg-surface group"
        >
            {previewVideoUrl ? (
                <video
                    ref={videoRef}
                    poster={coverImage}
                    onLoadedMetadata={handleLoadedMetadata}
                    muted
                    loop
                    playsInline
                    preload={eagerPreview ? "metadata" : "none"}
                    className={`w-full h-full object-cover transition-transform duration-300 ${isPlaying ? "scale-105" : "scale-100"}`}
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
                            onClick={handlePlayFromStart}
                            className="w-7 h-7 md:w-9 md:h-9 bg-foreground cursor-pointer rounded-full flex items-center justify-center hover:bg-foreground/80 transition-colors"
                        >
                            <Play size={16} className="fill-background text-background ml-0.5" />
                        </button>

                        <button
                            onClick={seriesKey ? handleToggleWatchlist : handleAction}
                            aria-pressed={watchlisted}
                            aria-label={watchlisted ? "Usuń z listy" : "Dodaj do listy"}
                            className={`w-7 h-7 md:w-9 md:h-9 border-2 cursor-pointer rounded-full flex items-center justify-center transition-all ${
                                watchlisted
                                    ? "border-primary bg-primary/20 text-primary hover:bg-primary/30"
                                    : "border-muted bg-surface/50 text-foreground hover:border-foreground hover:bg-surface-light"
                            }`}
                        >
                            {watchlisted ? <Check size={16} /> : <Plus size={16} />}
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
                    {year && <span className="text-muted">{year}</span>}
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

                {watchlistError && (
                    <span className="mt-1.5 text-[10px] md:text-xs text-danger">{watchlistError}</span>
                )}
            </div>

            {percent !== null && percent > 0 && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-background/50 z-10">
                    <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
            )}
        </div>
    );
};

export default SeriesCard;
