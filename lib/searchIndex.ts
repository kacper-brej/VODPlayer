import { cache } from "react";
import { getCatalog } from "@/lib/catalog";
import { dataEmpty, dataSuccess, type DataResult } from "@/lib/dataResult";
import type { SearchIndexEntry } from "@/components/layout/CommandPalette";

export type { SearchIndexEntry };

const buildSearchIndex = async (): Promise<DataResult<SearchIndexEntry[]>> => {
    const result = await getCatalog();
    if (result.kind === "error") return result;

    const entries = result.data.map((series) => ({
        key: series.key,
        title: series.title,
        year: series.year,
        episodeCount: series.episodeCount,
    }));

    return entries.length === 0 ? dataEmpty(entries) : dataSuccess(entries);
};

export const getSearchIndex = cache(buildSearchIndex);
