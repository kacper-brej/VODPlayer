"use client";

import type { KeyboardEvent, ReactNode } from "react";

interface CatalogGridProps {
    children: ReactNode;
    ariaLabel?: string;
}

const CatalogGrid = ({ children, ariaLabel = "Tytuły w katalogu" }: CatalogGridProps) => {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;

        const cards = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>("[data-content-card]"),
        );
        const current = (event.target as HTMLElement).closest<HTMLElement>("[data-content-card]");
        const currentIndex = current ? cards.indexOf(current) : -1;

        if (currentIndex < 0) return;

        const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const target = cards[currentIndex + direction];

        if (!target) return;

        event.preventDefault();
        target.focus();
        target.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "nearest",
            inline: "nearest",
        });
    };

    return (
        <div
            role="grid"
            aria-label={ariaLabel}
            onKeyDown={handleKeyDown}
            className="grid grid-cols-1 gap-x-4 gap-y-8 lg:grid-cols-12 lg:gap-x-5 lg:gap-y-10 xl:gap-x-6 xl:gap-y-12"
        >
            {children}
        </div>
    );
};

export default CatalogGrid;
