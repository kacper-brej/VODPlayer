import type { SaveProgressResponse } from "@/lib/core/contracts";

interface SaveProgressInput { seriesKey: string; episodeKey: string; positionSeconds: number }
type SaveProgressError = { success: false; error: "unauthenticated" | "backend" | "network" | "invalid_response" };

const saveProgressAction = async ({ seriesKey, episodeKey, positionSeconds }: SaveProgressInput): Promise<SaveProgressResponse | SaveProgressError> => {
    try {
        const res = await fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            keepalive: true,
            body: JSON.stringify({ series: seriesKey, episode: episodeKey, position: Math.max(0, Math.round(positionSeconds)) }),
        });
        if (res.status === 401) return { success: false, error: "unauthenticated" };
        if (!res.ok) {
            console.error("/api/progress ->", res.status, await res.text());
            return { success: false, error: "backend" };
        }
        const payload: unknown = await res.json();
        if (!payload || typeof payload !== "object" || !("success" in payload) || !("completed" in payload)
            || typeof payload.success !== "boolean" || typeof payload.completed !== "boolean") {
            return { success: false, error: "invalid_response" };
        }
        return { success: payload.success, completed: payload.completed };
    } catch (error) {
        console.error("saveProgressAction failed", error);
        return { success: false, error: "network" };
    }
};

export default saveProgressAction;
