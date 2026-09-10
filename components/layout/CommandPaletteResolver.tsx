"use client"
import { use } from "react";
import CommandPalette from "@/components/layout/CommandPalette";
import type { SearchIndexEntry } from "@/lib/search/searchIndex";
import type { DataResult } from "@/lib/core/dataResult";

interface CommandPaletteResolverProps {
    searchIndexPromise: Promise<DataResult<SearchIndexEntry[]>>;
    initiallyOpen?: boolean;
    onRetry: () => void;
}

const CommandPaletteResolver = ({
    searchIndexPromise,
    initiallyOpen = false,
    onRetry,
}: CommandPaletteResolverProps) => {
    const searchIndex = use(searchIndexPromise);
    return <CommandPalette searchIndex={searchIndex} initiallyOpen={initiallyOpen} onRetry={onRetry} />;
};

export default CommandPaletteResolver;
