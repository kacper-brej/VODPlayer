import { cache } from "react";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";

export interface ResumePoint {
    seriesKey: string;
    episodeKey: string;
    positionSeconds: number;
    durationSeconds: number | null;
    updatedAt: number;
}

const loadContinueWatching = async (): Promise<ResumePoint[]> => {
    const headers = await sessionHeaders();

    if (!headers) return [];

    try {
        const res = await fetch(`${VOD_ORIGIN}/progress.php?action=continue`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("progress.php continue ->", res.status, await res.text());
            return [];
        }

        const payload = await res.json();

        return Array.isArray(payload?.items) ? (payload.items as ResumePoint[]) : [];
    } catch (error) {
        console.error("continue-watching fetch failed", error);
        return [];
    }
};

export const getContinueWatching = cache(loadContinueWatching);

export const getResumeMap = cache(async (): Promise<Map<string, ResumePoint>> => {
    const items = await getContinueWatching();
    return new Map(items.map((item) => [item.seriesKey, item]));
});

export const getLatestResume = cache(async (): Promise<ResumePoint | null> => {
    const items = await getContinueWatching();
    return items[0] ?? null;
});

export const getSeriesResume = cache(async (seriesKey: string): Promise<ResumePoint | null> => {
    const map = await getResumeMap();
    return map.get(seriesKey) ?? null;
});
