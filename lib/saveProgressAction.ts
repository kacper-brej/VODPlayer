"use server";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";

interface SaveProgressInput {
    seriesKey: string;
    episodeKey: string;
    positionSeconds: number;
    durationSeconds?: number | null;
}

const saveProgressAction = async ({ seriesKey, episodeKey, positionSeconds, durationSeconds }: SaveProgressInput) => {
    const headers = await sessionHeaders();

    if (!headers) {
        console.error("saveProgressAction: brak ciasteczka sesji");
        return { success: false, error: "unauthenticated" };
    }

    try {
        const res = await fetch(`${VOD_ORIGIN}/progress.php`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            cache: "no-store",
            body: JSON.stringify({
                series: seriesKey,
                episode: episodeKey,
                position: Math.max(0, Math.round(positionSeconds)),
                duration: durationSeconds && durationSeconds > 0 ? Math.round(durationSeconds) : undefined,
            }),
        });

        if (!res.ok) {
            console.error("progress.php POST ->", res.status, await res.text());
            return { success: false, error: "backend" };
        }

        return (await res.json()) as { success: boolean; completed: boolean };
    } catch (error) {
        console.error("saveProgressAction failed", error);
        return { success: false, error: "network" };
    }
};

export default saveProgressAction;
