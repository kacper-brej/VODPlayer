"use server";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";

export interface EpisodeProgress {
    positionSeconds: number;
    durationSeconds: number | null;
    completed: boolean;
}

export const getSeriesProgressAction = async (
    seriesKey: string,
): Promise<{ episodes: Record<string, EpisodeProgress>; resume: { episodeKey: string; positionSeconds: number; durationSeconds: number | null } | null }> => {
    const headers = await sessionHeaders();
    const empty = { episodes: {}, resume: null };

    if (!headers || !seriesKey) return empty;

    try {
        const res = await fetch(`${VOD_ORIGIN}/progress.php?action=series&series=${encodeURIComponent(seriesKey)}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("progress.php series ->", res.status, await res.text());
            return empty;
        }

        const payload = await res.json();

        return {
            episodes: (payload?.episodes ?? {}) as Record<string, EpisodeProgress>,
            resume: payload?.resume ?? null,
        };
    } catch (error) {
        console.error("getSeriesProgressAction failed", error);
        return empty;
    }
};

const getProgressAction = async (seriesKey: string, episodeKey: string): Promise<number> => {
    const { episodes } = await getSeriesProgressAction(seriesKey);
    return episodes[episodeKey]?.positionSeconds ?? 0;
};

export default getProgressAction;
