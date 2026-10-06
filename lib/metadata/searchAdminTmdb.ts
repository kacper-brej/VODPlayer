import "server-only";
import { searchTmdbMovieList, searchTmdbTvList } from "./tmdbLists";
import { getTmdbImageBaseUrl } from "./tmdbConfig";
import { dataSuccess, type DataResult } from "@/lib/core/dataResult";
import type { SeriesCandidate } from "./types";
import { normalizeTitleForMatch } from "./identityMatch";

const normalize = (value: string) => normalizeTitleForMatch(value).replace(/ł/g, "l");

export const searchAdminTmdb = async (query: string): Promise<DataResult<SeriesCandidate[]>> => {
    const [tv, movies, imageBase] = await Promise.all([
        searchTmdbTvList(query), searchTmdbMovieList(query), getTmdbImageBaseUrl(),
    ]);
    // Do not auto-match a title against an incomplete set of films and series.
    if (tv.kind === "error") return tv;
    if (movies.kind === "error") return movies;
    if (imageBase.kind === "error") return imageBase;
    const year = (date: string | null) => date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
    return dataSuccess([
        ...tv.data.map((item): SeriesCandidate => ({
            providerId: "tmdb", externalId: `tv:${item.id}`, title: item.name, altTitles: [],
            year: year(item.first_air_date), format: "TV",
            coverImage: item.poster_path ? `${imageBase.data}w342${item.poster_path}` : null,
        })),
        ...movies.data.map((item): SeriesCandidate => ({
            providerId: "tmdb", externalId: `movie:${item.id}`, title: item.title, altTitles: [],
            year: year(item.release_date), format: "MOVIE",
            coverImage: item.poster_path ? `${imageBase.data}w342${item.poster_path}` : null,
        })),
    ].sort((a, b) => Number(normalize(b.title) === normalize(query)) - Number(normalize(a.title) === normalize(query))));
};

export const uniqueTmdbMatch = (title: string, candidates: SeriesCandidate[]): SeriesCandidate | null => {
    const normalized = normalize(title);
    const matches = candidates.filter((item) => [item.title, ...item.altTitles].some((value) => normalize(value) === normalized));
    return matches.length === 1 ? matches[0] : null;
};
