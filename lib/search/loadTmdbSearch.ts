import type { TmdbSearchHit } from "@/lib/search/tmdbSearchTypes";

const isSearchHit = (value: unknown): value is TmdbSearchHit => {
    if (!value || typeof value !== "object") return false;
    const hit = value as Partial<TmdbSearchHit>;
    return Number.isSafeInteger(hit.id) && Number(hit.id) > 0
        && typeof hit.title === "string"
        && (hit.year === null || Number.isSafeInteger(hit.year))
        && typeof hit.href === "string" && hit.href.startsWith("/series/")
        && (hit.poster === null || typeof hit.poster === "string");
};

export const loadTmdbSearch = async (query: string, signal: AbortSignal): Promise<TmdbSearchHit[]> => {
    const trimmed = query.trim();
    if (signal.aborted || trimmed.length < 2 || trimmed.length > 120) return [];

    const response = await fetch(`/api/search/tmdb?q=${encodeURIComponent(trimmed)}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
    });
    if (!response.ok || signal.aborted) return [];

    const result: unknown = await response.json();
    return !signal.aborted && Array.isArray(result) && result.every(isSearchHit) ? result : [];
};
