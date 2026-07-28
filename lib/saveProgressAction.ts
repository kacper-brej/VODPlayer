"use server";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateSaveProgressResponse,
    type SaveProgressResponse,
} from "@/lib/contracts";

interface SaveProgressInput {
    seriesKey: string;
    episodeKey: string;
    positionSeconds: number;
    durationSeconds?: number | null;
}

type SaveProgressError = {
    success: false;
    error: "unauthenticated" | "backend" | "network" | "invalid_response";
};

const saveProgressAction = async (
    { seriesKey, episodeKey, positionSeconds, durationSeconds }: SaveProgressInput,
): Promise<SaveProgressResponse | SaveProgressError> => {
    const headers = await sessionHeaders();

    if (!headers) {
        console.error("saveProgressAction: missing session cookie");
        return { success: false, error: "unauthenticated" };
    }

    try {
        const profileId = await selectedProfileId();
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
                profileId: profileId ?? undefined,
            }),
        });

        if (!res.ok) {
            console.error("progress.php POST ->", res.status, await res.text());
            return { success: false, error: "backend" };
        }

        const payload: unknown = await res.json();
        const result = validateSaveProgressResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return { success: false, error: "invalid_response" };
        }

        return result.data;
    } catch (error) {
        console.error("saveProgressAction failed", error);
        return { success: false, error: "network" };
    }
};

export default saveProgressAction;
