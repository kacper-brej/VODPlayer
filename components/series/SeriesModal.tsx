"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X, Play, CheckCircle2, FileVideo, ArrowUpRight, Users } from "lucide-react";
import Image from "next/image";
import { imageLoader } from "@/lib/catalog/imageDelivery";
import getSeriesDetailsAction, { SeriesDetails } from "@/lib/catalog/getSeriesDetailsAction";
import { DataErrorState, DataState } from "@/components/data/DataState";
import type { DataErrorReason } from "@/lib/core/dataResult";
import { partyWatchPath, seriesPath, watchPath } from "@/lib/core/routes";
import { useModalFocus } from "@/lib/core/useModalFocus";
import { startPartyForEpisode } from "@/lib/party/startPartyForEpisode";

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
    const [startingParty, setStartingParty] = useState(false);
    const [partyError, setPartyError] = useState<string | null>(null);

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
    const modalRef = useModalFocus<HTMLDivElement>(Boolean(movieId), closeModal);

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

    const watchTogether = async () => {
        const seriesKey = details?.seriesKey;
        const episodeKey = details?.resumeEpisodeKey ?? details?.episodes[0]?.key;
        if (!seriesKey || !episodeKey) return;

        setPartyError(null);
        setStartingParty(true);
        const result = await startPartyForEpisode(seriesKey, episodeKey);
        setStartingParty(false);

        if (!result.ok || !result.code) {
            setPartyError(result.error ?? "Nie udało się utworzyć pokoju.");
            return;
        }
        scheduleAfterClose(() => router.push(partyWatchPath(seriesKey, episodeKey, result.code!)));
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
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label="Szczegóły serialu"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className={`relative flex max-h-dvh w-full flex-col overflow-hidden bg-surface shadow-2xl outline-none transition-[transform,opacity] duration-200 ease-out md:max-h-[90vh] md:max-w-4xl md:rounded-xl ${showAnimation ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-[.97] opacity-0"}`}
            >
                <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Zamknij szczegóły serialu"
                    className="absolute right-4 top-[calc(16px+env(safe-area-inset-top))] z-50 flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-light text-foreground transition-colors hover:bg-primary hover:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary md:top-4"
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
                    <div className="flex min-h-0 w-full flex-1 flex-col pb-[calc(32px+env(safe-area-inset-bottom))] text-foreground">
                        <div className="w-full h-62.5 md:h-100 min-h-35 md:min-h-45 bg-surface-light animate-pulse relative">
                            <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/40 to-transparent" />
                        </div>
                        <div className="px-4 md:px-8 mt-4 relative z-10 flex min-h-0 flex-1 flex-col">
                            <div className="h-8 md:h-10 bg-surface-light/60 animate-pulse rounded-md w-2/3 mb-4"></div>
                            <div className="space-y-3 mb-8">
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-full"></div>
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-5/6"></div>
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-4/6"></div>
                            </div>
                            <div className="h-6 bg-surface-light/60 animate-pulse rounded-md w-32 mb-4"></div>
                            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
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
                    <div className="flex min-h-0 w-full flex-1 flex-col text-foreground">
                        <div className="w-full h-62.5 md:h-100 min-h-35 md:min-h-45 bg-surface-light relative">
                            {details.bannerImage && (
                                <Image
                                    src={details.bannerImage}
                                    alt={details.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, 896px"
                                    loader={imageLoader(details.bannerImage, "hero")}
                                />
                            )}
                            <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/40 to-transparent" />
                        </div>

                        <div className="px-4 md:px-8 mt-4 relative z-10 flex min-h-0 flex-1 flex-col">
                            <h2 id="series-modal-title" className="mb-2 shrink-0 text-2xl font-bold text-foreground drop-shadow-lg md:font-display md:text-4xl">
                                {details.title}
                            </h2>
                            <p className="shrink-0 text-sm md:text-base text-muted mb-6 line-clamp-4">
                                {details.synopsis}
                            </p>

                            <div className="mb-8 flex shrink-0 flex-wrap items-center gap-3">
                                <button
                                    onClick={goToSeriesPage}
                                    className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-light px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary md:px-5 md:py-2.5 md:text-base"
                                >
                                    Przejdź do strony serialu
                                    <ArrowUpRight size={18} />
                                </button>
                                {details.seriesKey && (
                                    <button
                                        type="button"
                                        onClick={watchTogether}
                                        disabled={startingParty}
                                        className={`flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-light px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary md:px-5 md:py-2.5 md:text-base ${startingParty ? "opacity-70" : ""}`}
                                    >
                                        <Users size={18} />
                                        {startingParty ? "Tworzenie pokoju…" : "Oglądaj razem"}
                                    </button>
                                )}
                            </div>
                            {partyError && (
                                <p role="alert" className="-mt-4 mb-6 text-sm text-nx-critical">{partyError}</p>
                            )}

                            <h3 className="mb-4 shrink-0 text-lg font-semibold text-foreground md:text-xl">
                                Odcinki ({details.episodes.length})
                            </h3>

                            <div className="-mr-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-[calc(24px+env(safe-area-inset-bottom))] pr-1 scrollbar-hide">
                                {details.episodes.map((episode) => (
                                    <button
                                        type="button"
                                        key={episode.key}
                                        onClick={() => openEpisode(episode.key)}
                                        className="group flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border bg-surface-light/50 p-3 text-left transition-[background-color,border-color] hover:border-border-hover hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary md:p-4"
                                    >
                                        <span className={`relative h-20 w-32 shrink-0 overflow-hidden rounded-md bg-background transition-opacity md:h-24 md:w-40 ${episode.watched ? "opacity-75 ring-2 ring-nx-text-2/40" : ""}`}>
                                            {episode.thumbnail ? (
                                                <Image
                                                    src={episode.thumbnail}
                                                    alt={episode.title}
                                                    fill
                                                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                                                    sizes="(max-width: 768px) 128px, 160px"
                                                    loader={imageLoader(episode.thumbnail, "episode")}
                                                />
                                            ) : (
                                                <span className="absolute inset-0 grid place-items-center font-mono text-nx-text-2">
                                                    {String(episode.number).padStart(2, "0")}
                                                </span>
                                            )}

                                            <div className="absolute inset-0 bg-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                    <span className={`flex size-11 items-center justify-center rounded-full border-2 ${episode.watched ? "border-nx-text-2/70 bg-nx-text-2/10 text-nx-text-2" : "border-foreground/60 bg-background/30 text-foreground"}`}>
                                                        <Play size={16} className="fill-current" />
                                                    </span>
                                            </div>

                                            {episode.watched && (
                                                <span className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full border border-nx-text-2/40 bg-nx-panel px-2 py-0.5 text-[10px] font-semibold text-nx-text-2">
                                                    <CheckCircle2 size={10} />
                                                    Obejrzane
                                                </span>
                                            )}

                                            {episode.percent > 0 && (
                                                <span className="absolute bottom-0 left-0 h-1 w-full bg-black/50">
                                                    <span className={`block h-full ${episode.watched ? "bg-nx-text-2" : "bg-primary"}`} style={{ width: `${episode.watched ? 100 : episode.percent}%` }} />
                                                </span>
                                            )}
                                        </span>

                                        <span className="flex flex-1 flex-col">
                                            <span className="text-foreground font-semibold text-sm md:text-base line-clamp-2">
                                                {episode.number}. {episode.title}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs text-muted mt-1">
                                                <FileVideo size={12} />
                                                {episode.key === details.resumeEpisodeKey ? "Wznów oglądanie" : "Odtwórz odcinek"}
                                            </span>
                                        </span>
                                    </button>
                                ))}

                                {details.episodes.length === 0 && (
                                    <div className="text-muted text-sm py-4">Brak dostępnych odcinków.</div>
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
