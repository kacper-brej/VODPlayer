import "server-only";
import { DatabaseError } from "@/lib/db/errors";
import type { WatchlistItem } from "@/lib/core/contracts";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import * as repo from "@/lib/watchlist/watchlistRepository";

const MAX_SERIES_KEY_LENGTH = 255;

const validateSeriesKey = (raw: string): string | null => {
    const key = raw.trim();
    if (key === "" || key.length > MAX_SERIES_KEY_LENGTH) return null;
    return key;
};

export const getWatchlist = async (userId: number, username: string): Promise<WatchlistItem[]> => {
    const profileId = await resolveOwnedProfileId(userId, username);
    return repo.listWatchlistForProfile(profileId);
};

export type WatchlistMutationResult = { ok: true; seriesKey: string } | { ok: false; code: "invalid" | "server" };

export const addToWatchlist = async (
    userId: number,
    username: string,
    rawSeriesKey: string,
): Promise<WatchlistMutationResult> => {
    const seriesKey = validateSeriesKey(rawSeriesKey);
    if (seriesKey === null) return { ok: false, code: "invalid" };

    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        await repo.upsertWatchlistItem(profileId, seriesKey);
        return { ok: true, seriesKey };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export const removeFromWatchlist = async (
    userId: number,
    username: string,
    rawSeriesKey: string,
): Promise<WatchlistMutationResult> => {
    const seriesKey = validateSeriesKey(rawSeriesKey);
    if (seriesKey === null) return { ok: false, code: "invalid" };

    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        await repo.deleteWatchlistItem(profileId, seriesKey);
        return { ok: true, seriesKey };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
