import "server-only";

type Stage = "session" | "access" | "manifest" | "watch_data";

// Fixed labels only; no paths, signatures, account IDs or database query text.
export const withServerTiming = async (work: (timing: {
    measure: <T>(stage: Stage, read: () => Promise<T>) => Promise<T>;
    playlistCache: (status: "hit" | "miss" | "shared" | "bypass") => void;
}) => Promise<Response>): Promise<Response> => {
    const startedAt = performance.now();
    const entries: string[] = [];
    const response = await work({
        async measure(stage, read) {
            const start = performance.now();
            try { return await read(); }
            finally { entries.push(`${stage};dur=${Math.max(0, performance.now() - start).toFixed(1)}`); }
        },
        playlistCache(status) { entries.push(`playlist_cache;desc="${status}"`); },
    });
    entries.push(`total;dur=${Math.max(0, performance.now() - startedAt).toFixed(1)}`);
    response.headers.set("Server-Timing", entries.join(", "));
    return response;
};
