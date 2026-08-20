import "server-only";
import { cache } from "react";
import { validateTmdbGenreListResponse } from "@/lib/core/contracts";
import { fetchTmdbResult } from "@/lib/metadata/tmdbConfig";

const GENRE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type TmdbGenreMap = ReadonlyMap<number, string>;

const loadGenres = async (kind: "tv" | "movie"): Promise<TmdbGenreMap> => {
    const response = await fetchTmdbResult(
        `/genre/${kind}/list?language=pl-PL`,
        (value) => validateTmdbGenreListResponse(value).ok,
        { cacheTtlMs: GENRE_CACHE_TTL_MS, maxRetries: 1 },
    );

    if (response.kind === "error") return new Map();

    const parsed = validateTmdbGenreListResponse(response.data);
    if (!parsed.ok) return new Map();

    return new Map(parsed.data.genres.map((genre) => [genre.id, genre.name]));
};

export const getTmdbGenreMap = cache(loadGenres);

export const genreNamesFromIds = (
    ids: readonly number[],
    genres: TmdbGenreMap,
): string[] => {
    const names: string[] = [];

    for (const id of ids) {
        const name = genres.get(id);
        if (name && !names.includes(name)) names.push(name);
    }

    return names;
};
