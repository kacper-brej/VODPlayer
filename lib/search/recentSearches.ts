const RECENT_SEARCHES_KEY = "nx_recent_searches";
const MAX_RECENT_SEARCHES = 5;

export const getRecentSearches = (): string[] => {
    if (typeof window === "undefined") return [];

    try {
        const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
        if (!raw) return [];

        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
        return [];
    }
};

export const addRecentSearch = (query: string): string[] => {
    const trimmed = query.trim();
    if (!trimmed || typeof window === "undefined") return getRecentSearches();

    const normalized = normalizeSearchText(trimmed);
    const next = [trimmed, ...getRecentSearches().filter((item) => normalizeSearchText(item) !== normalized)].slice(
        0,
        MAX_RECENT_SEARCHES,
    );

    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
};

export const clearRecentSearches = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
};
import { normalizeSearchText } from "@/lib/search";
