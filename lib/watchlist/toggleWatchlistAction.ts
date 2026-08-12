"use server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { addToWatchlist, removeFromWatchlist } from "@/lib/watchlist/watchlistService";
import { type ToggleWatchlistResponse } from "@/lib/core/contracts";

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
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };

    const result = inWatchlist
        ? await addToWatchlist(user.id, user.username, seriesKey)
        : await removeFromWatchlist(user.id, user.username, seriesKey);

    if (!result.ok) return { success: false, error: "backend" };

    revalidatePath("/");
    revalidatePath("/favourites");

    return { success: true, seriesKey: result.seriesKey };
};

export default toggleWatchlistAction;
