"use server";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateToggleWatchlistResponse,
    type ToggleWatchlistResponse,
} from "@/lib/contracts";

interface ToggleWatchlistInput {
    seriesKey: string;
    inWatchlist: boolean;
}

type ToggleWatchlistError = {
    success: false;
    error: "unauthenticated" | "backend" | "network" | "invalid_response";
};

const toggleWatchlistAction = async (
    { seriesKey, inWatchlist }: ToggleWatchlistInput,
): Promise<ToggleWatchlistResponse | ToggleWatchlistError> => {
    const headers = await sessionHeaders();

    if (!headers) {
        console.error("toggleWatchlistAction: missing session cookie");
        return { success: false, error: "unauthenticated" };
    }

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `&profile_id=${encodeURIComponent(profileId)}` : "";
        const res = inWatchlist
            ? await fetch(`${VOD_ORIGIN}/watchlist.php`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
                cache: "no-store",
                body: JSON.stringify({ series: seriesKey, profileId: profileId ?? undefined }),
            })
            : await fetch(`${VOD_ORIGIN}/watchlist.php?series=${encodeURIComponent(seriesKey)}${profileParam}`, {
                method: "DELETE",
                headers,
                cache: "no-store",
            });

        if (!res.ok) {
            console.error("watchlist.php ->", res.status, await res.text());
            return { success: false, error: "backend" };
        }

        const payload: unknown = await res.json();

        if (!inWatchlist) {
            return { success: true, seriesKey };
        }

        const result = validateToggleWatchlistResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return { success: false, error: "invalid_response" };
        }

        return result.data;
    } catch (error) {
        console.error("toggleWatchlistAction failed", error);
        return { success: false, error: "network" };
    }
};

export default toggleWatchlistAction;
