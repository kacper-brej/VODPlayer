"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { Check, Clock3, Info, MoreVertical, Plus, Star } from "lucide-react";
import toggleWatchlistAction from "@/lib/toggleWatchlistAction";
import { blurProps, imageLoader, safeArtworkColor } from "@/lib/imageDelivery";

export type ContentCardVariant = "landscape" | "poster" | "row" | "mosaic";

export interface CardInput {
    seriesKey: string;
    title: string;
    poster: string | null;
    backdrop: string | null;
    focal?: { x: number; y: number };
    dominantColor?: string | null;
    placeholder?: string | null;
    posterDominantColor?: string | null;
    posterPlaceholder?: string | null;
    backdropDominantColor?: string | null;
    backdropPlaceholder?: string | null;
    year?: number | null;
    seasonNumber?: number | null;
    genres?: string[];
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
    catalog?: boolean;
    imagePreload?: boolean;
    sizes?: string;
    tabIndex?: number;
    fill?: boolean;
    onWatchlistChange?: (seriesKey: string, inWatchlist: boolean) => void;
}

const WATCHLIST_ERROR_DISPLAY_MS = 2500;

const formatEpisode = (value: number) => String(value).padStart(2, "0");
const formatTime = (value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "--:--";

    const seconds = Math.floor(value);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const SeriesCard = ({
    item,
    variant = "landscape",
    featured = false,
    catalog = false,
    imagePreload = false,
    sizes = "(max-width: 639px) 82vw, (max-width: 1023px) 44vw, (max-width: 1439px) 30vw, 22vw",
    tabIndex = -1,
    fill = false,
    onWatchlistChange,
}: SeriesCardProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const containerRef = useRef<HTMLElement | null>(null);
    const watchlistErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
    const [watchlisted, setWatchlisted] = useState(Boolean(item.inWatchlist));
    const [syncedWatchlist, setSyncedWatchlist] = useState(Boolean(item.inWatchlist));
    const [watchlistError, setWatchlistError] = useState<string | null>(null);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

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
    const usingPoster = Boolean(preferredArtwork && item.poster && preferredArtwork === item.poster);
    const artworkRole = usingPoster ? "poster" : "catalog";
    const artworkPlaceholder = usingPoster ? item.posterPlaceholder : item.backdropPlaceholder;
    const artworkColor = usingPoster ? item.posterDominantColor : item.backdropDominantColor;
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
    const safeDominantColor = safeArtworkColor(artworkColor ?? item.dominantColor);
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
        setIsMoreMenuOpen(false);
        openInfo();
    };

    const toggleWatchlist = () => {
        const nextState = !watchlisted;
        setWatchlisted(nextState);
        onWatchlistChange?.(item.seriesKey, nextState);
        setWatchlistError(null);
        setIsMoreMenuOpen(false);

        void toggleWatchlistAction({ seriesKey: item.seriesKey, inWatchlist: nextState }).then((result) => {
            if (result.success) return;

            setWatchlisted(!nextState);
            onWatchlistChange?.(item.seriesKey, !nextState);
            setWatchlistError("Nie udało się zapisać listy.");

            if (watchlistErrorTimerRef.current) clearTimeout(watchlistErrorTimerRef.current);
            watchlistErrorTimerRef.current = setTimeout(
                () => setWatchlistError(null),
                WATCHLIST_ERROR_DISPLAY_MS,
            );
        });
    };

    const handleToggleWatchlist = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        toggleWatchlist();
    };

    const media = (
        <span
            className={`relative block overflow-hidden bg-nx-panel ${
                variant === "poster"
                    ? "aspect-2/3 rounded-t-2xl"
                    : variant === "row"
                        ? "m-3 aspect-video w-[132px] shrink-0 self-stretch rounded-xl sm:w-[176px] xl:w-[190px] min-[1440px]:w-[220px]"
                        : variant === "mosaic"
                            ? fill
                                ? "aspect-video lg:aspect-auto lg:h-full lg:min-h-[610px]"
                                : "aspect-video"
                            : variant === "landscape"
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
                    loader={imageLoader(artwork, artworkRole)}
                    {...blurProps(artworkPlaceholder ?? item.placeholder)}
                    onError={() => setFailedArtwork(artwork)}
                    className={`nx-card-artwork object-cover transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none ${completed ? "opacity-75" : ""}`}
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
                {variant === "row" && item.episodeNumber !== undefined && (
                    <span className="rounded-lg border border-white/12 bg-nx-bg/78 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.12em] text-nx-text shadow-sm backdrop-blur-md">
                        S{formatEpisode(item.seasonNumber ?? 1)} · E{formatEpisode(item.episodeNumber)}
                    </span>
                )}
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

            {variant !== "row" && (progress !== null || completed) && (
                <span className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-nx-border">
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
    const landscapeMetadataLine = (
        <span className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4 tracking-[0.04em] text-nx-text-2">
            {item.episodeNumber !== undefined && (
                <span>Odc. {formatEpisode(item.episodeNumber)}</span>
            )}
            {item.year && <span>{item.year}</span>}
            {item.score && (
                <span className="inline-flex items-center gap-1">
                    <Star size={11} fill="currentColor" className="text-nx-accent" aria-hidden="true" />
                    {item.score}
                </span>
            )}
            {remainingMinutes !== null && (
                <span className="inline-flex items-center gap-1">
                    <Clock3 size={11} aria-hidden="true" />
                    {remainingMinutes} min
                </span>
            )}
        </span>
    );
    const rowTags = [
        ...(item.genres ?? []).slice(0, 4),
        item.year ? String(item.year) : null,
    ].filter((value): value is string => Boolean(value));
    const currentTimeLabel = formatTime(item.positionSeconds ?? 0);
    const durationLabel = formatTime(item.durationSeconds);

    const actions = (
        <span
            className="relative flex items-center gap-2"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsMoreMenuOpen(false);
            }}
        >
            <button
                type="button"
                tabIndex={variant === "row" ? 0 : -1}
                onClick={handleToggleWatchlist}
                aria-pressed={watchlisted}
                aria-label={watchlisted ? "Usuń z listy" : "Dodaj do listy"}
                className={`flex size-11 items-center justify-center rounded-full border bg-nx-panel text-nx-text outline-none transition-colors duration-140 sm:size-12 ${
                    watchlisted
                        ? "border-nx-accent text-nx-text shadow-[0_0_0_1px_color-mix(in_srgb,var(--nx-accent)_18%,transparent)]"
                        : "border-nx-border hover:bg-nx-raised hover:text-nx-text"
                }`}
            >
                {watchlisted ? <Check size={18} /> : <Plus size={18} />}
            </button>

            {item.infoId !== undefined && (
                <button
                    type="button"
                    tabIndex={variant === "row" ? 0 : -1}
                    onClick={handleInfoClick}
                    aria-label={`Więcej informacji o ${item.title}`}
                    className="hidden size-11 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text-2 outline-none transition-colors duration-140 hover:bg-nx-raised hover:text-nx-text sm:flex sm:size-12"
                >
                    <Info size={18} />
                </button>
            )}

            {variant === "row" && (
                <span className="relative hidden sm:inline-flex">
                    <button
                        type="button"
                        tabIndex={0}
                        aria-label={`Więcej opcji dla ${item.title}`}
                        aria-expanded={isMoreMenuOpen}
                        aria-haspopup="menu"
                        onClick={(event) => {
                            event.stopPropagation();
                            setIsMoreMenuOpen((open) => !open);
                        }}
                        className="flex size-9 items-center justify-center rounded-full text-nx-text-2 outline-none transition-colors duration-140 hover:bg-nx-raised hover:text-nx-text"
                    >
                        <MoreVertical size={19} />
                    </button>

                    {isMoreMenuOpen && (
                        <span
                            role="menu"
                            className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-48 flex-col gap-1 rounded-2xl border border-nx-border bg-nx-panel p-2 text-left shadow-[0_24px_60px_-18px_rgba(0,0,0,0.95)]"
                        >
                            <button
                                type="button"
                                role="menuitem"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setIsMoreMenuOpen(false);
                                    navigate();
                                }}
                                className="rounded-xl px-3 py-2.5 text-left text-sm text-nx-text outline-none hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-nx-accent"
                            >
                                Otwórz serial
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleToggleWatchlist}
                                className="rounded-xl px-3 py-2.5 text-left text-sm text-nx-text outline-none hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-nx-accent"
                            >
                                {watchlisted ? "Usuń z listy" : "Dodaj do listy"}
                            </button>
                        </span>
                    )}
                </span>
            )}
        </span>
    );

    const body = variant === "row" ? (
        <span className="flex min-w-0 flex-1 flex-col justify-center py-4 pl-1 pr-[62px] sm:pr-[164px]">
            {metadataLine && <span className="mb-1.5">{metadataLine}</span>}
            <span className="line-clamp-1 text-[17px] font-semibold leading-[1.25] text-nx-text sm:text-lg" title={item.title}>
                {item.title}
            </span>
            <span className="mt-2 line-clamp-1 text-[12px] leading-[1.55] text-nx-text-2 sm:text-[13px]" title={item.description ?? undefined}>
                {item.description?.trim() || "Brak opisu"}
            </span>

            {rowTags.length > 0 && (
                <span className="mt-2 hidden min-w-0 flex-wrap gap-1.5 sm:flex">
                    {rowTags.map((tag) => (
                        <span
                            key={tag}
                            className="rounded-lg border border-nx-border bg-nx-bg/20 px-2.5 py-1 text-[10px] leading-none text-nx-text-2"
                        >
                            {tag}
                        </span>
                    ))}
                </span>
            )}

            <span className="mt-2 block min-w-0">
                <span
                    role="progressbar"
                    aria-label={`Postęp oglądania ${item.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress ?? 0}
                    className="block h-[3px] overflow-hidden rounded-full bg-nx-border"
                >
                    <span
                        className={`block h-full rounded-full ${completed ? "bg-nx-text-2" : "bg-nx-accent"}`}
                        style={{ width: `${completed ? 100 : progress ?? 0}%` }}
                    />
                </span>
                <span className="mt-1.5 flex items-center justify-between font-mono text-[9px] tabular-nums tracking-[0.08em] text-nx-text-2">
                    <span>{currentTimeLabel}</span>
                    <span>{durationLabel}</span>
                </span>
            </span>
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
    ) : variant === "landscape" ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-[linear-gradient(0deg,color-mix(in_srgb,var(--nx-bg)_96%,transparent)_0%,color-mix(in_srgb,var(--nx-bg)_72%,transparent)_48%,transparent_100%)] px-4 pb-4 pt-16 sm:px-5 sm:pb-5">
            <span className="line-clamp-2 text-[17px] font-semibold leading-[1.25] text-nx-text sm:text-lg" title={item.title}>
                {item.title}
            </span>
            {landscapeMetadataLine}
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
            data-catalog-card={catalog ? "true" : undefined}
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
            className={`nx-content-card group/card relative w-full scroll-mx-6 cursor-pointer rounded-2xl border bg-nx-panel text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent ${
                variant === "row"
                    ? `flex min-h-[164px] overflow-visible focus-within:z-30 ${
                        watchlisted
                            ? "border-[color-mix(in_srgb,var(--nx-accent)_72%,var(--nx-border))] bg-[linear-gradient(105deg,color-mix(in_srgb,var(--nx-panel)_96%,var(--nx-accent))_0%,var(--nx-panel)_58%,color-mix(in_srgb,var(--nx-panel)_93%,var(--nx-accent))_100%)]"
                            : "border-nx-border"
                    }`
                    : `overflow-hidden border-nx-border ${fill ? "lg:h-full" : ""}`
            }`}
        >
            {media}
            {body}

            <span className={`absolute z-10 ${variant === "row" ? "right-3 top-1/2 -translate-y-1/2" : "right-2 top-2"}`}>
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
