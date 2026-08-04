"use client"
import { use } from "react";
import CommandPalette from "@/components/layout/CommandPalette";
import type { SearchIndexEntry } from "@/lib/searchIndex";
import type { DataResult } from "@/lib/dataResult";

interface CommandPaletteResolverProps {
    searchIndexPromise: Promise<DataResult<SearchIndexEntry[]>>;
    initiallyOpen?: boolean;
}

const CommandPaletteResolver = ({
    searchIndexPromise,
    initiallyOpen = false,
}: CommandPaletteResolverProps) => {
    const searchIndex = use(searchIndexPromise);
    return <CommandPalette searchIndex={searchIndex} initiallyOpen={initiallyOpen} />;
};

export default CommandPaletteResolver;
