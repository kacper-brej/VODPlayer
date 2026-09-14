"use server";

import { getSessionUser } from "@/lib/auth/session";
import { searchTmdb } from "@/lib/search/searchTmdb";
import type { TmdbSearchHit } from "@/lib/search/tmdbSearchTypes";

export type { TmdbSearchHit } from "@/lib/search/tmdbSearchTypes";

const searchTmdbAction = async (query: string): Promise<TmdbSearchHit[]> => {
    if (!await getSessionUser()) return [];
    return searchTmdb(query);
};

export default searchTmdbAction;
