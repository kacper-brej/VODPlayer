import "server-only";

import { virtualTmdbKey } from "@/lib/catalog/tmdbVirtualSeries";
import { seriesPath } from "@/lib/core/routes";
import { getTmdbImageBaseUrl } from "@/lib/metadata/tmdbConfig";
import { tmdbProvider } from "@/lib/metadata/providers/tmdb";

import type { TmdbSearchHit } from "@/lib/search/tmdbSearchTypes";

const MAX_HITS = 8;
const TMDB_EXTERNAL_ID = /^tv:(\d+)$/;

export const searchTmdb = async (query: string, signal?: AbortSignal): Promise<TmdbSearchHit[]> => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > 120) return [];

    try {
        const [result, imageBase] = await Promise.all([
            tmdbProvider.searchSeries(trimmed, signal),
            getTmdbImageBaseUrl(signal)
                .then((value) => value.kind === "error" ? null : value.data)
                .catch(() => null),
        ]);

        if (result.kind === "error") return [];

        const hits: TmdbSearchHit[] = [];

        for (const candidate of result.data) {
            const match = TMDB_EXTERNAL_ID.exec(candidate.externalId);
            if (!match) continue;

            const id = Number(match[1]);
            if (!Number.isSafeInteger(id) || id <= 0) continue;

            hits.push({
                id,
                title: candidate.title,
                year: candidate.year,
                href: seriesPath(virtualTmdbKey(id)),
                poster: candidate.coverImage && imageBase
                    ? `${imageBase}w185${candidate.coverImage}`
                    : null,
            });

            if (hits.length >= MAX_HITS) break;
        }

        return hits;
    } catch (error) {
        console.error("TMDB search failed", error);
        return [];
    }
};

