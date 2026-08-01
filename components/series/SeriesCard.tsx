"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { Check, Info, Plus } from "lucide-react";
import toggleWatchlistAction from "@/lib/toggleWatchlistAction";

export type ContentCardVariant = "landscape" | "poster" | "row" | "mosaic";

export interface CardInput {
    seriesKey: string;
    title: string;
    poster: string | null;
    backdrop: string | null;
    focal?: { x: number; y: number };
    dominantColor?: string | null;
    placeholder?: string | null;
    year?: number | null;
    score?: string | null;
    ageRating?: string | null;
    description?: string | null;
    episodeKey?: string;
    episodeNumber?: number;
    positionSeconds?: number;
    durationSeconds?: number | null;
    completed?: boolean;
    addedAt?: number;
    isNew?: boolean;
    href: string;
    infoId?: string | number;
    inWatchlist?: boolean;
}

export interface SeriesCardProps {
    item: CardInput;
    variant?: ContentCardVariant;
    featured?: boolean;
    imagePreload?: boolean;
    sizes?: string;
    tabIndex?: number;
}

const WATCHLIST_ERROR_DISPLAY_MS = 2500;

const formatEpisode = (value: number) => String(value).padStart(2, "0");

const SeriesCard = ({
    item,
    variant = "landscape",
    featured = false,
    imagePreload = false,
    sizes = "(max-width: 639px) 82vw, (max-width: 1023px) 44vw, (max-width: 1439px) 30vw, 22vw",
    tabIndex = -1,
}: SeriesCardProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const containerRef = useRef<HTMLElement | null>(null);
    const watchlistErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
    const [watchlisted, setWatchlisted] = useState(Boolean(item.inWatchlist));
    const [syncedWatchlist, setSyncedWatchlist] = useState(Boolean(item.inWatchlist));
    const [watchlistError, setWatchlistError] = useState<string | null>(null);

    if (Boolean(item.inWatchlist) !== syncedWatchlist) {
        setSyncedWatchlist(Boolean(item.inWatchlist));
        setWatchlisted(Boolean(item.inWatchlist));
    }

    useEffect(() => {
        return () => {
            if (watchlistErrorTimerRef.current) clearTimeout(watchlistErrorTimerRef.current);
        };
    }, []);

    const preferredArtwork = variant === "poster"
        ? item.poster ?? item.backdrop
        : item.backdrop ?? item.poster;
    const artwork = preferredArtwork === failedArtwork ? null : preferredArtwork;
    const usesPosterFallback = variant !== "poster" && artwork === item.poster && !item.backdrop;
    const hasKnownDuration = typeof item.durationSeconds === "number" && item.durationSeconds > 0;
    const hasPosition = typeof item.positionSeconds === "number" && item.positionSeconds > 0;
    const completed = Boolean(item.completed);
    const progress = completed
        ? 100
        : hasPosition && hasKnownDuration
            ? Math.min(100, Math.round((item.positionSeconds! / item.durationSeconds!) * 100))
            : null;
    const progressDescription = completed
        ? ", obejrzane"
        : progress !== null
            ? `, obejrzane w ${progress}%`
            : hasPosition
                ? ", rozpoczęte"
                : "";
    const remainingMinutes = hasPosition && hasKnownDuration
        ? Math.max(0, Math.ceil((item.durationSeconds! - item.positionSeconds!) / 60))
        : null;
    const safeDominantColor = item.dominantColor && /^#[0-9a-f]{6}$/i.test(item.dominantColor)
        ? item.dominantColor
        : null;
    const artworkStyle: CSSProperties | undefined = safeDominantColor
        ? { background: `color-mix(in srgb, ${safeDominantColor} 8%, var(--nx-panel))` }
        : undefined;
    const objectPosition = `${Math.round((item.focal?.x ?? 0.5) * 100)}% ${Math.round((item.focal?.y ?? 0.4) * 100)}%`;

    const navigate = () => router.push(item.href);

    const openInfo = () => {
        if (item.infoId === undefined) return;
        const params = new URLSearchParams(window.location.search);
        params.set("info", String(item.infoId));
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigate();
        } else if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && item.infoId !== undefined) {
            event.preventDefault();
            openInfo();
        }
    };

    const handleInfoClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        openInfo();
    };

    const handleToggleWatchlist = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();

        const nextState = !watchlisted;
        setWatchlisted(nextState);
        setWatchlistError(null);

        void toggleWatchlistAction({ seriesKey: item.seriesKey, inWatchlist: nextState }).then((result) => {
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

    const media = (
        <span
            className={`relative block overflow-hidden bg-nx-panel ${
                variant === "poster"
                    ? "aspect-2/3 rounded-t-2xl"
                    : variant === "row"
                        ? "my-auto ml-3 aspect-video w-[116px] shrink-0 rounded-[10px] sm:w-[132px]"
                        : variant === "mosaic"
                            ? "aspect-video"
                            : "aspect-video rounded-t-2xl"
            }`}
            style={artworkStyle}
        >
            {artwork ? (
                <Image
                    src={artwork}
                    alt={item.title}
                    fill
                    preload={imagePreload}
                    sizes={sizes}
                    onError={() => setFailedArtwork(artwork)}
                    className={`${usesPosterFallback ? "object-contain" : "object-cover"} ${completed ? "opacity-75" : ""}`}
                    style={{ objectPosition }}
                />
            ) : (
                <span className="absolute inset-0 flex flex-col justify-end gap-2 p-4">
                    {item.episodeNumber !== undefined && (
                        <span className="font-mono text-[10px] tracking-[0.18em] text-nx-text-2">
                            ODCINEK {formatEpisode(item.episodeNumber)}
                        </span>
                    )}
                    <span className="line-clamp-3 text-sm font-semibold leading-[1.35] text-nx-text">
                        {item.title}
                    </span>
                </span>
            )}

            <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--nx-text)_9%,transparent)]" />

            <span className="absolute left-2 top-2 flex items-center gap-2">
                {completed && (
                    <span className="rounded-full border border-nx-border bg-nx-panel px-2.5 py-1 font-mono text-[9px] tracking-[0.16em] text-nx-text-2">
                        OBEJRZANE
                    </span>
                )}
                {!completed && item.isNew && (
                    <span className="rounded-full bg-nx-accent-2 px-2.5 py-1 font-mono text-[9px] tracking-[0.16em] text-nx-on-accent">
                        NOWY
                    </span>
                )}
            </span>

            {(progress !== null || completed) && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-nx-border">
                    <span
                        className={`block h-full ${completed ? "bg-nx-text-2" : "bg-nx-accent"}`}
                        style={{ width: `${completed ? 100 : progress}%` }}
                    />
                </span>
            )}
        </span>
    );

    const metadata = [
        item.episodeNumber !== undefined ? `ODCINEK ${formatEpisode(item.episodeNumber)}` : null,
        item.year ? String(item.year) : null,
        item.score ? `OCENA ${item.score}` : null,
        remainingMinutes !== null ? `${remainingMinutes} MIN DO KOŃCA` : null,
    ].filter((value): value is string => Boolean(value));
    const metadataLine = (metadata.length > 0 || item.ageRating) && (
        <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-nx-text-2">
            {item.ageRating && (
                <span className="shrink-0 rounded-[10px] border border-nx-border px-2 py-1 text-nx-text-2">
                    {item.ageRating}
                </span>
            )}
            {metadata.length > 0 && (
                <span className="line-clamp-1">{metadata.join(" · ")}</span>
            )}
        </span>
    );

    const actions = (
        <span className="flex items-center gap-2">
            <button
                type="button"
                tabIndex={-1}
                onClick={handleToggleWatchlist}
                aria-pressed={watchlisted}
                aria-label={watchlisted ? "Usuń z listy" : "Dodaj do listy"}
                className={`flex size-11 items-center justify-center rounded-full border bg-nx-panel text-nx-text outline-none transition-colors duration-140 ${
                    watchlisted
                        ? "border-nx-accent text-nx-accent"
                        : "border-nx-border hover:bg-nx-raised hover:text-nx-text"
                }`}
            >
                {watchlisted ? <Check size={18} /> : <Plus size={18} />}
            </button>

            {item.infoId !== undefined && (
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={handleInfoClick}
                    aria-label={`Więcej informacji o ${item.title}`}
                    className="flex size-11 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text-2 outline-none transition-colors duration-140 hover:bg-nx-raised hover:text-nx-text"
                >
                    <Info size={18} />
                </button>
            )}
        </span>
    );

    const body = variant === "row" ? (
        <span className="flex min-w-0 flex-1 flex-col justify-center py-3 pl-3 pr-27">
            {metadataLine && <span className="mb-1.5">{metadataLine}</span>}
            <span className="line-clamp-2 text-[15px] font-semibold leading-[1.35] text-nx-text" title={item.title}>
                {item.title}
            </span>
            {item.description && (
                <span className="mt-2 line-clamp-2 text-[13px] leading-[1.6] text-nx-text-2">
                    {item.description}
                </span>
            )}
        </span>
    ) : variant === "mosaic" ? (
        <span className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-nx-bg via-nx-bg/55 to-transparent p-4 sm:p-5">
            {metadataLine && <span className="mb-2">{metadataLine}</span>}
            <span
                className={`line-clamp-2 text-nx-text ${
                    featured
                        ? "font-display text-[28px] leading-[1.02] tracking-[-0.015em] sm:text-[30px]"
                        : "text-[15px] font-semibold leading-[1.35]"
                }`}
                title={item.title}
            >
                {item.title}
            </span>
            {featured && item.description && (
                <span className="mt-3 line-clamp-2 max-w-[52ch] text-[13px] leading-[1.6] text-nx-text-2">
                    {item.description}
                </span>
            )}
        </span>
    ) : (
        <span className="flex min-w-0 flex-col gap-2 px-1 pb-1 pt-3">
            {metadataLine}
            <span className="line-clamp-2 text-[15px] font-semibold leading-[1.35] text-nx-text sm:text-base" title={item.title}>
                {item.title}
            </span>
        </span>
    );

    return (
        <article
            ref={containerRef}
            data-content-card
            role="link"
            tabIndex={tabIndex}
            aria-label={`${item.title}${progressDescription}`}
            onClick={navigate}
            onKeyDown={handleCardKeyDown}
            onContextMenu={(event) => {
                if (item.infoId === undefined) return;
                event.preventDefault();
                openInfo();
            }}
            className={`nx-content-card group/card relative w-full scroll-mx-6 cursor-pointer rounded-2xl border border-nx-border bg-nx-panel text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent ${
                variant === "row"
                    ? "flex min-h-22 overflow-hidden"
                    : variant === "mosaic"
                        ? "overflow-hidden"
                        : "overflow-visible"
            }`}
        >
            {media}
            {body}

            <span className={`absolute right-2 z-10 ${variant === "row" ? "top-1/2 -translate-y-1/2" : "top-2"}`}>
                {actions}
            </span>

            {watchlistError && (
                <span
                    role="status"
                    className="absolute bottom-2 right-2 z-20 rounded-full border border-nx-critical/40 bg-nx-panel px-3 py-1.5 text-xs text-nx-critical"
                >
                    {watchlistError}
                </span>
            )}
        </article>
    );
};

export default SeriesCard;
