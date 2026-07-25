"use client";

interface SeasonSelectorProps {
    seasons: number[];
    activeSeason: number;
    onSeasonChange: (season: number) => void;
}

const SeasonSelector = ({seasons, activeSeason, onSeasonChange}: SeasonSelectorProps) => {
    return (
        <div className="w-full mb-8">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2">
                {seasons.map((season) => (
                    <button
                        key={season}
                        onClick={() => onSeasonChange(season)}
                        className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 whitespace-nowrap border
                        ${activeSeason === season ?
                            `bg-foreground text-background border-transparent` :
                            `bg-surface/50 text-muted border-white/5 hover:text-foreground hover:bg-surface-light hover:border-white/20`}`}
                    >
                        Sezon {season}
                    </button>
                ))}
            </div>
        </div>
    )
}

export default SeasonSelector;