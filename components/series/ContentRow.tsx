"use client";

import { Children, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type ContentRowVariant = "progress" | "ranking" | "mosaic" | "classic";

interface ContentRowProps {
    title: string;
    kicker: string;
    variant: ContentRowVariant;
    itemCount: number;
    children: ReactNode;
}

const horizontalItemClass: Record<Exclude<ContentRowVariant, "mosaic">, string> = {
    progress: "basis-[82%] sm:basis-[48%] lg:basis-[calc((100%-40px)/3)] min-[1440px]:basis-[calc((100%-72px)/4)]",
    ranking: "basis-[40%] sm:basis-[28%] lg:basis-[calc((100%-60px)/4)] xl:basis-[calc((100%-96px)/5)] min-[1440px]:basis-[calc((100%-120px)/6)]",
    classic: "basis-[70%] sm:basis-[44%] lg:basis-[calc((100%-40px)/3)] xl:basis-[calc((100%-72px)/4)] min-[1440px]:basis-[calc((100%-96px)/5)]",
};

const ContentRow = ({
    title,
    kicker,
    variant,
    itemCount,
    children,
}: ContentRowProps) => {
    const titleId = useId();
    const rowRef = useRef<HTMLDivElement | null>(null);
    const cardStepRef = useRef(0);
    const pageStepRef = useRef(0);
    const [canMoveLeft, setCanMoveLeft] = useState(false);
    const [canMoveRight, setCanMoveRight] = useState(itemCount > 1);
    const items = Children.toArray(children);
    const isMosaic = variant === "mosaic";

    const cards = useCallback(() => {
        if (!rowRef.current) return [];
        return Array.from(rowRef.current.querySelectorAll<HTMLElement>("[data-content-card]"));
    }, []);

    const updateNavigation = useCallback(() => {
        const row = rowRef.current;
        if (!row || isMosaic) return;

        const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
        setCanMoveLeft(row.scrollLeft > 2);
        setCanMoveRight(row.scrollLeft < maxScroll - 2);
    }, [isMosaic]);

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

        const rowCards = cards();
        rowCards.forEach((card, index) => {
            card.tabIndex = index === 0 ? 0 : -1;
        });

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(row);

        return () => observer.disconnect();
    }, [cards, measure]);

    const setRovingCard = (target: HTMLElement) => {
        cards().forEach((card) => {
            card.tabIndex = card === target ? 0 : -1;
        });
    };

    const focusCard = (index: number) => {
        const rowCards = cards();
        const target = rowCards[Math.max(0, Math.min(rowCards.length - 1, index))];

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

        const rowCards = cards();
        const currentIndex = rowCards.findIndex((card) => card === document.activeElement);

        if (currentIndex < 0) return;

        event.preventDefault();
        focusCard(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
    };

    const move = (direction: -1 | 1) => {
        if (isMosaic) {
            const rowCards = cards();
            const currentIndex = rowCards.findIndex((card) => card === document.activeElement);
            const nextIndex = currentIndex < 0
                ? direction > 0 ? 0 : rowCards.length - 1
                : (currentIndex + direction + rowCards.length) % rowCards.length;
            focusCard(nextIndex);
            return;
        }

        const row = rowRef.current;
        const cardStep = cardStepRef.current;
        const pageStep = pageStepRef.current;

        if (!row || !cardStep || !pageStep) return;

        const currentIndex = Math.round(row.scrollLeft / cardStep);
        const cardsPerPage = Math.max(1, Math.round(pageStep / cardStep));
        const targetIndex = Math.max(0, currentIndex + direction * cardsPerPage);
        const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
        const target = Math.min(maxScroll, targetIndex * cardStep);

        row.scrollTo({
            left: target,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        });
    };

    if (itemCount === 0) return null;

    return (
        <section
            aria-labelledby={titleId}
            className="group/section w-full min-w-0"
        >
            <header className="mb-5 flex items-end gap-4 sm:mb-6">
                <div className="min-w-0">
                    <span className="block font-mono text-[10px] tracking-[0.22em] text-nx-text-2 sm:text-[11px]">
                        {kicker}
                    </span>
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
                            aria-label={`Przewiń sekcję ${title} w lewo`}
                            className="flex size-11 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text-2 opacity-0 outline-none transition-[opacity,color,background-color] duration-140 hover:bg-nx-raised hover:text-nx-text focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent disabled:pointer-events-none disabled:opacity-25 group-hover/section:opacity-100"
                        >
                            <ChevronLeft size={19} />
                        </button>
                        <button
                            type="button"
                            onClick={() => move(1)}
                            disabled={!isMosaic && !canMoveRight}
                            aria-label={`Przewiń sekcję ${title} w prawo`}
                            className="flex size-11 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text-2 opacity-0 outline-none transition-[opacity,color,background-color] duration-140 hover:bg-nx-raised hover:text-nx-text focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent disabled:pointer-events-none disabled:opacity-25 group-hover/section:opacity-100"
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
                    if (target) setRovingCard(target);
                }}
                onScroll={updateNavigation}
                className={
                    isMosaic
                        ? "grid grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-3 lg:gap-5 xl:gap-6"
                        : "scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain py-3 scroll-smooth motion-reduce:scroll-auto lg:gap-5 xl:gap-6"
                }
            >
                {items.map((child, index) => {
                    if (isMosaic) {
                        const mosaicClass = index === 0
                            ? "lg:col-span-7 lg:row-span-3"
                            : `lg:col-span-5 ${index === 3 ? "lg:max-xl:hidden" : ""}`;

                        return (
                            <div
                                key={index}
                                data-row-item
                                className={`nx-section-item ${mosaicClass}`}
                                style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
                            >
                                {child}
                            </div>
                        );
                    }

                    return (
                        <div
                            key={index}
                            data-row-item
                            className={`nx-section-item relative min-w-0 shrink-0 snap-start ${horizontalItemClass[variant]}`}
                            style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
                        >
                            {variant === "ranking" && (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -left-[0.08em] bottom-7 z-0 font-display text-[76px] leading-[0.84] tracking-[-0.05em] text-transparent [-webkit-text-stroke:1px_color-mix(in_srgb,var(--nx-accent)_42%,transparent)] sm:text-[92px] xl:text-[112px] min-[1440px]:text-[128px]"
                                >
                                    {index + 1}
                                </span>
                            )}
                            <div className={variant === "ranking" ? "relative z-10 ml-[18%] w-[82%]" : ""}>
                                {child}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default ContentRow;
