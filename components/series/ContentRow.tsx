"use client";

import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getContentRowActiveIndex, getContentRowWindow, isContentRowItemMounted } from "@/lib/ui/contentRowWindow";

export type ContentRowVariant = "progress" | "ranking" | "mosaic" | "classic";

interface ContentRowProps {
    title: string;
    kicker?: string;
    numbered?: boolean;
    variant: ContentRowVariant;
    itemCount: number;
    children: ReactNode;
    renderPlaceholder?: (index: number) => ReactNode;
    onMosaicMove?: (direction: -1 | 1) => void;
    mosaicPanelHeader?: ReactNode;
}

export const rowKickerClass = "block font-mono text-[10px] tracking-[0.22em] text-nx-text-2 sm:text-[11px]";

const horizontalItemClass: Record<Exclude<ContentRowVariant, "mosaic">, string> = {
    progress: "basis-[82%] sm:basis-[48%] lg:basis-[calc((100%-40px)/3)] min-[1440px]:basis-[calc((100%-72px)/4)]",
    ranking: "basis-[40%] sm:basis-[30%] lg:basis-[calc((100%-168px)/4)] xl:basis-[calc((100%-256px)/5)] min-[1440px]:basis-[calc((100%-320px)/6)]",
    classic: "basis-[70%] sm:basis-[44%] lg:basis-[calc((100%-40px)/3)] xl:basis-[calc((100%-72px)/4)] min-[1440px]:basis-[calc((100%-96px)/5)]",
};

const ContentRow = ({
    title,
    kicker,
    numbered = false,
    variant,
    itemCount,
    children,
    renderPlaceholder,
    onMosaicMove,
    mosaicPanelHeader,
}: ContentRowProps) => {
    const titleId = useId();
    const rowRef = useRef<HTMLDivElement | null>(null);
    const cardStepRef = useRef(0);
    const pageStepRef = useRef(0);
    const navigationFrameRef = useRef<number | null>(null);
    const pendingFocusRef = useRef(false);
    const [canMoveLeft, setCanMoveLeft] = useState(false);
    const [canMoveRight, setCanMoveRight] = useState(false);
    const [activeCard, setActiveCard] = useState<{ index: number; key: string | null }>({ index: 0, key: null });
    const [visibleWindow, setVisibleWindow] = useState(() => getContentRowWindow(itemCount, 0, 0, 0));
    const items = useMemo(() => Children.toArray(children), [children]);
    const itemKeys = useMemo(() => items.map((child, index) => String(isValidElement(child) ? child.key : index)), [items]);
    const activeCardIndex = getContentRowActiveIndex(itemKeys, activeCard.index, activeCard.key);
    const isMosaic = variant === "mosaic";

    const cards = useCallback(() => {
        if (!rowRef.current) return [];
        return Array.from(rowRef.current.querySelectorAll<HTMLElement>("[data-content-card]"));
    }, []);

    const updateNavigation = useCallback(() => {
        const row = rowRef.current;
        if (!row || isMosaic) return;

        const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
        const startOffset = Number.parseFloat(getComputedStyle(row).paddingLeft) || 0;
        const nextWindow = getContentRowWindow(itemCount, row.scrollLeft, row.clientWidth, cardStepRef.current, startOffset);

        setVisibleWindow((current) => current.start === nextWindow.start && current.end === nextWindow.end
            ? current
            : nextWindow);

        if (maxScroll <= 2) {
            setCanMoveLeft(false);
            setCanMoveRight(false);
            return;
        }

        setCanMoveLeft(row.scrollLeft > startOffset + 2);
        setCanMoveRight(row.scrollLeft < maxScroll - 2);
    }, [isMosaic, itemCount]);

    const scheduleNavigationUpdate = useCallback(() => {
        if (navigationFrameRef.current !== null) return;

        navigationFrameRef.current = window.requestAnimationFrame(() => {
            navigationFrameRef.current = null;
            updateNavigation();
        });
    }, [updateNavigation]);

    const measure = useCallback(() => {
        const row = rowRef.current;
        const firstItem = row?.querySelector<HTMLElement>("[data-row-item]");

        if (!row || !firstItem || isMosaic) return;

        const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
        const cardStep = firstItem.getBoundingClientRect().width + gap;
        const cardsPerView = Math.max(1, Math.floor((row.clientWidth + gap) / cardStep));

        cardStepRef.current = cardStep;
        pageStepRef.current = cardStep * cardsPerView;
        updateNavigation();
    }, [isMosaic, updateNavigation]);

    useEffect(() => {
        const row = rowRef.current;
        if (!row) return;

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(row);

        return () => {
            observer.disconnect();
            if (navigationFrameRef.current !== null) {
                window.cancelAnimationFrame(navigationFrameRef.current);
                navigationFrameRef.current = null;
            }
        };
    }, [itemCount, measure]);

    useLayoutEffect(() => {
        const rowCards = cards();
        rowCards.forEach((card) => {
            card.tabIndex = Number(card.closest<HTMLElement>("[data-row-item]")?.dataset.rowItem) === activeCardIndex ? 0 : -1;
        });

        if (!pendingFocusRef.current) return;

        const target = rowRef.current?.querySelector<HTMLElement>(
            `[data-row-item="${activeCardIndex}"] [data-content-card]:not([data-row-placeholder])`,
        );

        if (target) {
            pendingFocusRef.current = false;
            target.focus({ preventScroll: true });
        }
    }, [activeCardIndex, cards, items, visibleWindow]);

    const setRovingCard = (target: HTMLElement) => {
        cards().forEach((card) => {
            card.tabIndex = card === target ? 0 : -1;
        });
    };

    const focusCard = (index: number) => {
        const targetIndex = Math.max(0, Math.min(items.length - 1, index));
        const target = rowRef.current?.querySelector<HTMLElement>(`[data-row-item="${targetIndex}"] [data-content-card]`);

        if (!target) return;

        setRovingCard(target);
        target.focus();
        target.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "nearest",
            inline: "nearest",
        });
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

        const active = document.activeElement as HTMLElement | null;
        const currentIndex = active?.matches("[data-content-card]")
            ? Number(active.closest<HTMLElement>("[data-row-item]")?.dataset.rowItem ?? -1)
            : -1;

        if (currentIndex < 0) return;

        event.preventDefault();
        focusCard(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
    };

    const move = (direction: -1 | 1) => {
        if (isMosaic) {
            onMosaicMove?.(direction);
            return;
        }

        const row = rowRef.current;
        const cardStep = cardStepRef.current;
        const pageStep = pageStepRef.current;

        if (!row || !cardStep || !pageStep) return;

        const startOffset = Number.parseFloat(getComputedStyle(row).paddingLeft) || 0;
        const currentIndex = Math.round((row.scrollLeft - startOffset) / cardStep);
        const cardsPerPage = Math.max(1, Math.round(pageStep / cardStep));
        const targetIndex = Math.max(0, currentIndex + direction * cardsPerPage);
        const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
        const target = Math.min(maxScroll, startOffset + targetIndex * cardStep);

        row.scrollTo({
            left: target,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        });
    };

    if (itemCount === 0 && !isMosaic) return null;

    return (
        <section
            aria-labelledby={titleId}
            className="group/section w-full min-w-0"
        >
            <header className="mb-5 flex items-end gap-4 sm:mb-6">
                <div className="min-w-0">
                    {numbered
                        ? <span aria-hidden="true" className={`nx-row-index ${rowKickerClass}`} />
                        : kicker && <span className={rowKickerClass}>{kicker}</span>}
                    <h2
                        id={titleId}
                        className="mt-1 text-xl font-semibold leading-[1.08] text-nx-text sm:font-display sm:text-[28px] min-[1440px]:text-[30px]"
                    >
                        {title}
                    </h2>
                </div>

                <span className="mb-2 h-px min-w-6 flex-1 bg-nx-border" />

                {itemCount > 1 && (
                    <span className="mb-0.5 hidden items-center gap-2 [@media(pointer:fine)]:flex">
                        <button
                            type="button"
                            onClick={() => move(-1)}
                            disabled={!isMosaic && !canMoveLeft}
                            aria-disabled={!isMosaic && !canMoveLeft}
                            aria-label={`Przewiń sekcję ${title} w lewo`}
                            className="flex size-11 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text-2 opacity-0 outline-none transition-[opacity,color,background-color,border-color] duration-140 hover:bg-nx-raised hover:text-nx-text focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-nx-text-2/25 group-hover/section:opacity-100"
                        >
                            <ChevronLeft size={19} />
                        </button>
                        <button
                            type="button"
                            onClick={() => move(1)}
                            disabled={!isMosaic && !canMoveRight}
                            aria-disabled={!isMosaic && !canMoveRight}
                            aria-label={`Przewiń sekcję ${title} w prawo`}
                            className="flex size-11 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text-2 opacity-0 outline-none transition-[opacity,color,background-color,border-color] duration-140 hover:bg-nx-raised hover:text-nx-text focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-nx-text-2/25 group-hover/section:opacity-100"
                        >
                            <ChevronRight size={19} />
                        </button>
                    </span>
                )}
            </header>

            <div
                ref={rowRef}
                role="group"
                aria-label={title}
                onKeyDown={handleKeyDown}
                onFocusCapture={(event) => {
                    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-content-card]");
                    if (!target) return;

                    const index = Number(target.closest<HTMLElement>("[data-row-item]")?.dataset.rowItem);
                    if (target.hasAttribute("data-row-placeholder")) pendingFocusRef.current = true;
                    setActiveCard((current) => current.index === index && current.key === itemKeys[index]
                        ? current
                        : { index, key: itemKeys[index] });
                    setRovingCard(target);
                }}
                onScroll={scheduleNavigationUpdate}
                className={
                    isMosaic
                        ? "grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch lg:gap-5"
                        : `scrollbar-hide -mx-2 flex w-[calc(100%+1rem)] snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-2 py-4 scroll-smooth motion-reduce:scroll-auto ${
                            variant === "ranking"
                                ? "gap-10 sm:gap-14 xl:gap-16"
                                : "gap-4 lg:gap-5 xl:gap-6"
                        }`
                }
            >
                {isMosaic ? (
                    <>
                        {items[0] && (
                            <div
                                data-row-item={0}
                                className="nx-section-item min-h-0 lg:col-span-5 lg:h-full min-[1600px]:col-span-6"
                                style={{ animationDelay: "0ms" }}
                            >
                                {items[0]}
                            </div>
                        )}

                        <div
                            className={`min-w-0 rounded-[22px] border border-nx-border bg-[linear-gradient(145deg,color-mix(in_srgb,var(--nx-panel)_96%,var(--nx-accent))_0%,var(--nx-panel)_48%,color-mix(in_srgb,var(--nx-bg)_78%,var(--nx-panel))_100%)] p-3 shadow-[0_26px_70px_-34px_rgba(0,0,0,0.95)] sm:p-4 lg:p-5 ${
                                items.length === 0
                                    ? "lg:col-span-12"
                                    : "lg:col-span-7 min-[1600px]:col-span-6"
                            }`}
                        >
                            {mosaicPanelHeader}

                            <div className="mt-4 grid gap-4">
                                {items.slice(1).map((child, index) => (
                                    <div
                                        key={index}
                                        data-row-item={index + 1}
                                        className="nx-section-item min-w-0"
                                        style={{ animationDelay: `${Math.min((index + 1) * 60, 300)}ms` }}
                                    >
                                        {child}
                                    </div>
                                ))}

                                {items.length <= 1 && (
                                    <div className="flex min-h-[164px] items-center justify-center rounded-2xl border border-dashed border-nx-border px-6 text-center text-sm text-nx-text-2">
                                        Brak pozycji pasujących do filtra.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : items.map((child, index) => (
                    <div
                        key={isValidElement(child) ? child.key : index}
                        data-row-item={index}
                        className={`nx-section-item relative min-w-0 shrink-0 snap-start ${horizontalItemClass[variant]}`}
                        style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
                    >
                        {!renderPlaceholder || isContentRowItemMounted(index, visibleWindow, activeCardIndex)
                            ? child
                            : renderPlaceholder(index)}
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ContentRow;
