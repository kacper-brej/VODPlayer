"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState } from "react";
import getSearchIndexAction from "@/lib/getSearchIndexAction";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/lib/commandPalette";
import type { DataResult } from "@/lib/dataResult";
import type { SearchIndexEntry } from "@/lib/searchIndex";

const CommandPaletteResolver = dynamic(
    () => import("@/components/layout/CommandPaletteResolver"),
    { ssr: false },
);

const PaletteLoading = () => (
    <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[90] flex items-start justify-center bg-[#07070A]/[0.62] px-3 pt-3 lg:pt-[12vh]"
    >
        <div className="flex min-h-14 w-full max-w-[640px] items-center rounded-2xl border border-border bg-surface px-5 text-sm text-muted shadow-[0_34px_70px_-20px_rgba(0,0,0,0.9)]">
            Otwieranie wyszukiwania…
        </div>
    </div>
);

const CommandPaletteLauncher = () => {
    const requestedRef = useRef(false);
    const [searchIndexPromise, setSearchIndexPromise] = useState<Promise<DataResult<SearchIndexEntry[]>> | null>(null);

    useEffect(() => {
        if (searchIndexPromise) return;

        const requestPalette = () => {
            if (requestedRef.current) return;
            requestedRef.current = true;
            setSearchIndexPromise(getSearchIndexAction());
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
            event.preventDefault();
            requestPalette();
        };

        window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, requestPalette);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, requestPalette);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [searchIndexPromise]);

    if (!searchIndexPromise) return null;

    return (
        <Suspense fallback={<PaletteLoading />}>
            <CommandPaletteResolver
                searchIndexPromise={searchIndexPromise}
                initiallyOpen
            />
        </Suspense>
    );
};

export default CommandPaletteLauncher;
