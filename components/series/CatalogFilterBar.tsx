"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import type { CatalogGenre } from "@/lib/core/contracts";

interface FilterOption {
    value: string;
    label: string;
    href: string;
    active: boolean;
}

interface FilterTabsProps {
    label: string;
    options: FilterOption[];
}

interface CatalogFilterBarProps {
    basePath: string;
    query: string;
    sort: string;
    genre: string;
    genres: CatalogGenre[];
    showGenres?: boolean;
}

const FilterTabs = ({ label, options }: FilterTabsProps) => {
    const refs = useRef<(HTMLAnchorElement | null)[]>([]);

    const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
        let target = index;

        if (event.key === "ArrowRight") target = (index + 1) % options.length;
        else if (event.key === "ArrowLeft") target = (index - 1 + options.length) % options.length;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = options.length - 1;
        else return;

        event.preventDefault();
        refs.current[target]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={label}
            className="scrollbar-hide flex max-w-full gap-2 overflow-x-auto pb-1"
        >
            {options.map((option, index) => (
                <Link
                    key={option.value}
                    ref={(node) => {
                        refs.current[index] = node;
                    }}
                    href={option.href}
                    prefetch={false}
                    role="tab"
                    aria-selected={option.active}
                    tabIndex={option.active ? 0 : -1}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    className={`relative flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[13.5px] outline-none transition-colors duration-140 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent ${
                        option.active
                            ? "border-nx-border bg-nx-raised text-nx-text after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-nx-accent"
                            : "border-nx-border bg-nx-panel text-nx-text-2 hover:bg-nx-raised hover:text-nx-text"
                    }`}
                >
                    {option.label}
                </Link>
            ))}
        </div>
    );
};

const CatalogFilterBar = ({
    basePath,
    query,
    sort,
    genre,
    genres,
    showGenres = true,
}: CatalogFilterBarProps) => {
    const hrefFor = (next: { sort?: string; genre?: string; query?: string }) => {
        const params = new URLSearchParams();
        const nextQuery = next.query ?? query;
        const nextSort = next.sort ?? sort;
        const nextGenre = next.genre ?? genre;

        if (nextQuery) params.set("q", nextQuery);
        if (nextSort && nextSort !== "featured") params.set("sort", nextSort);
        if (nextGenre) params.set("genre", nextGenre);

        const value = params.toString();
        return value ? `${basePath}?${value}` : basePath;
    };

    const sortOptions: FilterOption[] = [
        { value: "featured", label: "Archiwum", href: hrefFor({ sort: "featured" }), active: sort === "featured" },
        { value: "newest", label: "Najnowsze", href: hrefFor({ sort: "newest" }), active: sort === "newest" },
        { value: "title", label: "A–Z", href: hrefFor({ sort: "title" }), active: sort === "title" },
        { value: "year", label: "Rok", href: hrefFor({ sort: "year" }), active: sort === "year" },
        { value: "score", label: "Ocena", href: hrefFor({ sort: "score" }), active: sort === "score" },
    ];
    const genreOptions: FilterOption[] = [
        { value: "", label: "Wszystkie gatunki", href: hrefFor({ genre: "" }), active: genre === "" },
        ...genres.map((item) => ({
            value: item.slug,
            label: item.name,
            href: hrefFor({ genre: item.slug }),
            active: genre === item.slug,
        })),
    ];

    return (
        <div className="max-lg:sticky max-lg:top-[72px] max-lg:z-20 max-lg:-mx-5 max-lg:border-y max-lg:border-nx-border max-lg:bg-nx-bg max-lg:px-5 max-lg:py-4 sm:max-lg:-mx-8 sm:max-lg:px-8">
            <form action={basePath} className="mb-3 flex w-full max-w-xl items-center gap-2">
                {sort !== "featured" && <input type="hidden" name="sort" value={sort} />}
                {genre && <input type="hidden" name="genre" value={genre} />}
                <label className="relative flex-1">
                    <span className="sr-only">Szukaj w katalogu</span>
                    <Search
                        size={17}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-nx-text-2"
                    />
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Szukaj tytułu"
                        className="min-h-11 w-full rounded-full border border-nx-border bg-nx-panel py-2 pl-11 pr-4 text-sm text-nx-text outline-none placeholder:text-nx-text-2 focus:border-nx-accent focus:outline-2 focus:outline-offset-[3px] focus:outline-nx-accent"
                    />
                </label>
                <button
                    type="submit"
                    className="flex min-h-11 items-center rounded-full border border-nx-border bg-nx-panel px-5 text-sm font-semibold text-nx-text outline-none transition-colors duration-140 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
                >
                    Szukaj
                </button>
                {query && (
                    <Link
                        href={hrefFor({ query: "" })}
                        prefetch={false}
                        aria-label="Wyczyść wyszukiwanie"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text-2 outline-none transition-colors duration-140 hover:bg-nx-raised hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
                    >
                        <X size={17} />
                    </Link>
                )}
            </form>

            <div className="flex flex-col gap-2">
                <FilterTabs label="Sortowanie katalogu" options={sortOptions} />
                {showGenres && genres.length > 0 && (
                    <FilterTabs label="Filtrowanie według gatunku" options={genreOptions} />
                )}
            </div>
        </div>
    );
};

export default CatalogFilterBar;
