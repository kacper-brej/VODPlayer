"use client"
import { use } from "react";
import CommandPalette from "@/components/layout/CommandPalette";
import type { SearchIndexEntry } from "@/lib/searchIndex";
import type { DataResult } from "@/lib/dataResult";

interface CommandPaletteResolverProps {
    searchIndexPromise: Promise<DataResult<SearchIndexEntry[]>>;
}

const CommandPaletteResolver = ({ searchIndexPromise }: CommandPaletteResolverProps) => {
    const searchIndex = use(searchIndexPromise);
    return <CommandPalette searchIndex={searchIndex} />;
};

export default CommandPaletteResolver;
