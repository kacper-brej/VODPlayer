"use client";

import { useState } from "react";
import { ArrowUpDown, Check, ChevronDown, Filter } from "lucide-react";
import ContentRow, { type ContentRowVariant } from "@/components/series/ContentRow";
import SeriesCard, { type CardInput, type ContentCardVariant } from "@/components/series/SeriesCard";

interface ContentRowSectionProps {
    title: string;
    kicker: string;
    variant: ContentRowVariant;
    items: CardInput[];
}

type MosaicSort = "newest" | "rating";

const itemCountLabel = (count: number) => {
    if (count === 1) return "1 pozycja";
    if (count >= 2 && count <= 4) return `${count} pozycje`;
    return `${count} pozycji`;
};

const scoreValue = (score: string | null | undefined) => {
    const parsed = Number.parseFloat(score ?? "");
    return Number.isFinite(parsed) ? parsed : -1;
};

const mosaicSortOptions: { value: MosaicSort; label: string }[] = [
    { value: "newest", label: "Od najnowszych" },
    { value: "rating", label: "Według oceny" },
];

const cardVariant = (
    variant: ContentRowVariant,
    index: number,
): ContentCardVariant => {
    if (variant === "ranking") return "poster";
    if (variant === "mosaic") return index === 0 ? "mosaic" : "row";
    return "landscape";
};

const cardSizes = (variant: ContentRowVariant, index: number) => {
    if (variant === "ranking") {
        return "(max-width: 639px) 34vw, (max-width: 1023px) 23vw, (max-width: 1279px) 19vw, (max-width: 1439px) 16vw, 14vw";
    }

    if (variant === "mosaic") {
        return index === 0
            ? "(max-width: 1023px) 100vw, (max-width: 1439px) 56vw, 58vw"
            : "(max-width: 639px) 132px, (max-width: 1023px) 176px, (max-width: 1439px) 190px, 220px";
    }

    if (variant === "progress") {
        return "(max-width: 639px) 82vw, (max-width: 1023px) 48vw, (max-width: 1439px) 31vw, 24vw";
    }

    return "(max-width: 639px) 70vw, (max-width: 1023px) 44vw, (max-width: 1279px) 31vw, (max-width: 1439px) 24vw, 19vw";
};

const ContentRowSection = ({
    title,
    kicker,
    variant,
    items,
}: ContentRowSectionProps) => {
    const [mosaicLead, setMosaicLead] = useState(0);
    const [mosaicSort, setMosaicSort] = useState<MosaicSort>("newest");
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [onlyWatchlisted, setOnlyWatchlisted] = useState(false);
    const [watchlistOverrides, setWatchlistOverrides] = useState<Record<string, boolean>>({});

    if (items.length === 0) return null;

    const firstNewKey = items.find((item) => item.isNew)?.seriesKey ?? null;
    const effectiveItems = items.map((item) => ({
        ...item,
        inWatchlist: watchlistOverrides[item.seriesKey] ?? item.inWatchlist,
    }));
    const filteredItems = variant === "mosaic" && onlyWatchlisted
        ? effectiveItems.filter((item) => item.inWatchlist)
        : effectiveItems;
    const orderedItems = variant === "mosaic"
        ? [...filteredItems].sort((left, right) => mosaicSort === "rating"
            ? scoreValue(right.score) - scoreValue(left.score)
            : (right.addedAt ?? 0) - (left.addedAt ?? 0))
        : filteredItems;
    const normalizedLead = orderedItems.length > 0
        ? ((mosaicLead % orderedItems.length) + orderedItems.length) % orderedItems.length
        : 0;
    const displayedItems = variant === "mosaic" && orderedItems.length > 0
        ? orderedItems.map((_, offset) => orderedItems[(normalizedLead + offset) % orderedItems.length])
        : orderedItems;
    const sideItemCount = Math.max(0, displayedItems.length - 1);
    const hasWatchlisted = effectiveItems.some((item) => item.inWatchlist);
    const mosaicSortLabel = mosaicSortOptions.find((option) => option.value === mosaicSort)?.label
        ?? mosaicSortOptions[0].label;
    const mosaicPanelHeader = variant === "mosaic" ? (
        <div className="flex flex-col gap-4 border-b border-nx-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-baseline gap-3">
                <h3 className="text-xl font-semibold tracking-[-0.02em] text-nx-text sm:text-2xl">
                    Odcinki
                </h3>
                <span className="text-sm text-nx-text-2">{itemCountLabel(sideItemCount)}</span>
            </div>

            <div className="flex items-center gap-2">
                <div
                    className="relative flex-1 sm:flex-none"
                    onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setIsSortOpen(false);
                    }}
                    onKeyDown={(event) => {
                        if (event.key !== "Escape") return;
                        event.stopPropagation();
                        setIsSortOpen(false);
                    }}
                >
                    <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={isSortOpen}
                        onClick={() => setIsSortOpen((open) => !open)}
                        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border bg-nx-panel px-3 text-sm outline-none transition-colors duration-140 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent sm:w-auto ${
                            isSortOpen
                                ? "border-nx-accent text-nx-text"
                                : "border-nx-border text-nx-text-2 hover:bg-nx-raised hover:text-nx-text"
                        }`}
                    >
                        <ArrowUpDown size={16} className="shrink-0" aria-hidden="true" />
                        <span className="hidden text-nx-text-2 sm:inline">Sortuj:</span>
                        <span className="max-w-36 truncate font-medium text-nx-text">{mosaicSortLabel}</span>
                        <ChevronDown
                            size={15}
                            aria-hidden="true"
                            className={`ml-auto shrink-0 transition-transform duration-140 ${isSortOpen ? "rotate-180" : ""}`}
                        />
                    </button>

                    {isSortOpen && (
                        <ul
                            role="listbox"
                            aria-label="Sortowanie odcinków"
                            className="absolute right-0 top-[calc(100%+8px)] z-50 w-full min-w-[220px] rounded-2xl border border-nx-border bg-nx-panel p-2 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.95)]"
                        >
                            {mosaicSortOptions.map((option) => {
                                const active = option.value === mosaicSort;

                                return (
                                    <li key={option.value} role="presentation">
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            onClick={() => {
                                                setMosaicSort(option.value);
                                                setMosaicLead(0);
                                                setIsSortOpen(false);
                                            }}
                                            className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors duration-140 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-nx-accent ${
                                                active
                                                    ? "bg-nx-raised text-nx-text"
                                                    : "text-nx-text-2 hover:bg-nx-raised hover:text-nx-text"
                                            }`}
                                        >
                                            <span>{option.label}</span>
                                            {active && <Check size={16} className="text-nx-accent" aria-hidden="true" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <button
                    type="button"
                    aria-pressed={onlyWatchlisted}
                    title={onlyWatchlisted ? "Pokaż wszystkie pozycje" : "Pokaż tylko pozycje z mojej listy"}
                    disabled={!hasWatchlisted && !onlyWatchlisted}
                    onClick={() => {
                        setOnlyWatchlisted((current) => !current);
                        setMosaicLead(0);
                    }}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm outline-none transition-colors duration-140 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                        onlyWatchlisted
                            ? "border-nx-accent bg-nx-accent/10 text-nx-text"
                            : "border-nx-border bg-nx-panel text-nx-text-2 hover:bg-nx-raised hover:text-nx-text"
                    }`}
                >
                    <Filter size={16} aria-hidden="true" />
                    <span className="hidden sm:inline">Filtry</span>
                </button>
            </div>
        </div>
    ) : null;

    return (
        <ContentRow
            title={title}
            kicker={kicker}
            variant={variant}
            itemCount={displayedItems.length}
            mosaicPanelHeader={mosaicPanelHeader}
            onMosaicMove={variant === "mosaic"
                ? (direction) => setMosaicLead((current) =>
                    orderedItems.length > 0
                        ? (current + direction + orderedItems.length) % orderedItems.length
                        : 0
                )
                : undefined}
        >
            {displayedItems.map((item, index) => {
                const showNew = item.seriesKey === firstNewKey;

                return (
                    <SeriesCard
                        key={`${item.seriesKey}:${item.episodeKey ?? "series"}`}
                        item={{
                            ...item,
                            isNew: showNew,
                        }}
                        variant={cardVariant(variant, index)}
                        featured={variant === "mosaic" && index === 0}
                        fill={variant === "mosaic" && index === 0}
                        onWatchlistChange={(seriesKey, inWatchlist) => {
                            setWatchlistOverrides((current) => ({
                                ...current,
                                [seriesKey]: inWatchlist,
                            }));
                        }}
                        sizes={cardSizes(variant, index)}
                    />
                );
            })}
        </ContentRow>
    );
};

export default ContentRowSection;
