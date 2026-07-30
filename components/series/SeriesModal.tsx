"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X, Play, CheckCircle2, FileVideo, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import getSeriesDetailsAction, { SeriesDetails } from "@/lib/getSeriesDetailsAction";
import { DataErrorState, DataState } from "@/components/data/DataState";
import type { DataErrorReason } from "@/lib/dataResult";
import { seriesPath, watchPath } from "@/lib/routes";

const CLOSE_ANIMATION_MS = 200;

const SeriesModal = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const movieId = searchParams.get("info");

    const [details, setDetails] = useState<SeriesDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<DataErrorReason | null>(null);
    const [missing, setMissing] = useState(false);
    const [retryKey, setRetryKey] = useState(0);
    const [showAnimation, setShowAnimation] = useState(false);

    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleAfterClose = (action: () => void) => {
        setShowAnimation(false);
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = setTimeout(action, CLOSE_ANIMATION_MS);
    };

    const closeModal = () => {
        scheduleAfterClose(() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("info");
            const query = params.toString();
            router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
        });
    };

    const goToSeriesPage = () => {
        if (!details) return;
        const routeId = details.seriesKey ?? details.id;
        scheduleAfterClose(() => router.push(seriesPath(routeId)));
    };

    const openEpisode = (episodeKey: string) => {
        if (!details?.seriesKey) return;
        const seriesKey = details.seriesKey;
        scheduleAfterClose(() => router.push(watchPath(seriesKey, episodeKey)));
    };

    useEffect(() => {
        if (!movieId) return;

        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }

        let cancelled = false;
        const frame = requestAnimationFrame(() => {
            if (!cancelled) setShowAnimation(true);
        });

        const load = async () => {
            setLoading(true);
            setFailure(null);
            setMissing(false);
            const result = await getSeriesDetailsAction(Number(movieId));

            if (cancelled) return;

            if (result.kind === "error") {
                setDetails(null);
                setFailure(result.reason);
            } else if (!result.data) {
                setDetails(null);
                setMissing(true);
            } else {
                setDetails(result.data);
            }

            setLoading(false);
        };

        void load();

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
        };
    }, [movieId, retryKey]);

    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        };
    }, []);

    if (!movieId) return null;

    return (
        <div
            onClick={closeModal}
            className={`fixed inset-0 z-50 flex items-start pt-0 md:pt-[5vh] justify-center bg-background/90 p-0 md:p-4 transition-opacity duration-200 ease-out ${showAnimation ? "opacity-100" : "opacity-0"}`}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full max-h-dvh md:max-h-[90vh] md:max-w-4xl bg-surface md:rounded-xl shadow-2xl overflow-y-auto scrollbar-hide transition-all duration-200 ease-out ${showAnimation ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"}`}
            >
                <button
                    onClick={closeModal}
                    className="absolute top-4 right-4 z-50 w-8 h-8 md:w-10 md:h-10 bg-surface-light/80 hover:bg-primary text-foreground rounded-full flex items-center justify-center transition-colors cursor-pointer backdrop-blur-sm"
                >
                    <X size={20} className="md:w-6 md:h-6" />
                </button>

                {failure ? (
                    <div className="p-4 md:p-8">
                        <DataErrorState
                            reason={failure}
                            onRetry={() => setRetryKey((value) => value + 1)}
                        />
                    </div>
                ) : missing ? (
                    <div className="p-4 md:p-8">
                        <DataState
                            kind="empty"
                            title="Nie znaleziono tytułu"
                            description="Ten tytuł nie jest już dostępny."
                        />
                    </div>
                ) : loading || !details ? (
                    <div className="text-foreground pb-8 w-full">
                        <div className="w-full h-62.5 md:h-100 shrink-0 bg-surface-light animate-pulse relative">
                            <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/40 to-transparent" />
                        </div>
                        <div className="px-4 md:px-8 mt-4 relative z-10">
                            <div className="h-8 md:h-10 bg-surface-light/60 animate-pulse rounded-md w-2/3 mb-4"></div>
                            <div className="space-y-3 mb-8">
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-full"></div>
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-5/6"></div>
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-4/6"></div>
                            </div>
                            <div className="h-6 bg-surface-light/60 animate-pulse rounded-md w-32 mb-4"></div>
                            <div className="flex flex-col gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-4 p-3 md:p-4 bg-surface-light/30 rounded-lg border border-border">
                                        <div className="relative w-32 h-20 md:w-40 md:h-24 shrink-0 rounded-md bg-surface-light/60 animate-pulse"></div>
                                        <div className="flex flex-col flex-1 gap-3">
                                            <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-3/4"></div>
                                            <div className="h-3 bg-surface-light/50 animate-pulse rounded-md w-1/4"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-foreground pb-8 w-full">
                        <div className="w-full h-62.5 md:h-100 shrink-0 bg-surface-light relative">
                            <Image
                                src={details.bannerImage}
                                alt={details.title}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 896px"
                                priority
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/40 to-transparent" />
                        </div>

                        <div className="px-4 md:px-8 mt-4 relative z-10">
                            <h1 className="mb-2 text-2xl font-bold text-foreground drop-shadow-lg md:font-display md:text-4xl">
                                {details.title}
                            </h1>
                            <p className="text-sm md:text-base text-muted mb-6 line-clamp-4 md:line-clamp-none">
                                {details.synopsis}
                            </p>

                            <button
                                onClick={goToSeriesPage}
                                className="mb-8 flex items-center gap-2 w-fit bg-surface-light hover:bg-primary text-foreground px-4 md:px-5 py-2 md:py-2.5 text-sm md:text-base rounded-lg font-semibold border border-border hover:border-primary transition-colors cursor-pointer"
                            >
                                Przejdź do strony serialu
                                <ArrowUpRight size={18} />
                            </button>

                            <h2 className="text-lg md:text-xl font-semibold mb-4 text-foreground">
                                Odcinki ({details.episodes.length})
                            </h2>

                            <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-1 -mr-1 scrollbar-hide">
                                {details.episodes.map((episode) => (
                                    <div
                                        key={episode.key}
                                        onClick={() => openEpisode(episode.key)}
                                        className="flex items-center gap-4 p-3 md:p-4 bg-surface-light/50 rounded-lg border border-border hover:border-border-hover hover:bg-surface-light transition-all cursor-pointer group"
                                    >
                                        <div className={`relative w-32 h-20 md:w-40 md:h-24 shrink-0 rounded-md overflow-hidden bg-background transition-all ${episode.watched ? "opacity-75 ring-2 ring-nx-text-2/40" : ""}`}>
                                            <Image
                                                src={episode.thumbnail}
                                                alt={episode.title}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                sizes="(max-width: 768px) 128px, 160px"
                                            />

                                            <div className="absolute inset-0 bg-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className={`w-10 h-10 flex items-center justify-center rounded-full border-2 backdrop-blur-sm ${episode.watched ? "border-nx-text-2/70 bg-nx-text-2/10 text-nx-text-2" : "border-foreground/60 bg-background/30 text-foreground"}`}>
                                                    <Play size={16} className="fill-current" />
                                                </div>
                                            </div>

                                            {episode.watched && (
                                                <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 text-[9px] md:text-[10px] font-semibold text-nx-text-2 bg-nx-text-2/20 backdrop-blur-md border border-nx-text-2/40 rounded-full px-2 py-0.5">
                                                    <CheckCircle2 size={10} />
                                                    Obejrzane
                                                </span>
                                            )}

                                            {episode.percent > 0 && (
                                                <div className="absolute bottom-0 left-0 w-full h-1 bg-black/50">
                                                    <div className={`h-full ${episode.watched ? "bg-nx-text-2" : "bg-primary"}`} style={{ width: `${episode.watched ? 100 : episode.percent}%` }} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col flex-1">
                                            <span className="text-foreground font-semibold text-sm md:text-base line-clamp-2">
                                                {episode.number}. {episode.title}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs text-muted mt-1">
                                                <FileVideo size={12} />
                                                {episode.key === details.resumeEpisodeKey ? "Wznów oglądanie" : "Wideo MP4"}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {details.episodes.length === 0 && (
                                    <div className="text-muted text-sm py-4">Brak dostępnych odcinków w bazie.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeriesModal;
