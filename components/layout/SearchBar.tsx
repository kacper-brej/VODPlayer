"use client";
import { Search } from "lucide-react";
import { openCommandPalette } from "@/lib/commandPalette";

const SearchBar = () => {
    return (
        <>
            <button
                type="button"
                onClick={openCommandPalette}
                aria-label="Otwórz wyszukiwanie"
                className="fixed top-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground outline-none transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary sm:hidden"
            >
                <Search size={20} strokeWidth={2} aria-hidden="true" />
            </button>

            <button
                type="button"
                onClick={openCommandPalette}
                className="hidden h-11 w-full max-w-md items-center gap-3 rounded-full border border-border bg-surface px-4 text-left text-muted outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary sm:flex"
            >
                <Search size={18} strokeWidth={2} aria-hidden="true" />
                <span className="flex-1 text-sm">Szukaj…</span>
                <span className="hidden items-center gap-0.5 rounded-md border border-border bg-surface-light px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted lg:flex">
                    Ctrl K
                </span>
            </button>
        </>
    );
};

export default SearchBar;
