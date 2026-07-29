"use client";

import { useRef } from "react";

export interface SeasonOption {
    id: string;
    label: string;
    episodeCount: number;
    completed: boolean;
}

interface SeasonSelectorProps {
    seasons: SeasonOption[];
    activeSeason: string;
    onSeasonChange: (season: string) => void;
}

const SeasonsSelector = ({ seasons, activeSeason, onSeasonChange }: SeasonSelectorProps) => {
    const tabs = useRef<Array<HTMLButtonElement | null>>([]);

    if (seasons.length === 1) {
        return (
            <p className="font-mono text-[11px] tracking-[0.16em] text-nx-text-2">
                {seasons[0].label.toUpperCase()}
            </p>
        );
    }

    const selectAt = (index: number) => {
        const target = seasons[index];
        if (!target) return;
        onSeasonChange(target.id);
        tabs.current[index]?.focus();
        tabs.current[index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    };

    return (
        <div
            role="tablist"
            aria-label="Sezony"
            className="flex snap-x gap-2 overflow-x-auto pb-2 scrollbar-hide xl:sticky xl:top-6 xl:flex-col xl:items-start xl:overflow-visible xl:pb-0"
        >
            {seasons.map((season, index) => {
                const active = season.id === activeSeason;

                return (
                    <button
                        key={season.id}
                        ref={(element) => { tabs.current[index] = element; }}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onSeasonChange(season.id)}
                        onKeyDown={(event) => {
                            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                                event.preventDefault();
                                selectAt((index + 1) % seasons.length);
                            }
                            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                                event.preventDefault();
                                selectAt((index - 1 + seasons.length) % seasons.length);
                            }
                            if (event.key === "Home") {
                                event.preventDefault();
                                selectAt(0);
                            }
                            if (event.key === "End") {
                                event.preventDefault();
                                selectAt(seasons.length - 1);
                            }
                        }}
                        className={`min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent xl:w-full xl:rounded-lg ${
                            active
                                ? "border-nx-accent bg-nx-raised font-semibold text-nx-text"
                                : "border-nx-border bg-transparent font-normal text-nx-text-2 hover:bg-nx-raised hover:text-nx-text"
                        }`}
                    >
                        <span className="block">{season.label}</span>
                        <span className="mt-0.5 block font-mono text-[10px] tracking-[0.12em] text-nx-text-2">
                            {season.completed ? "UKOŃCZONO" : `${season.episodeCount} ODC.`}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default SeasonsSelector;
