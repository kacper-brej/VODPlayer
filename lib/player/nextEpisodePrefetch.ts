import type { WatchData } from "./watchData";

export const NEXT_EPISODE_PREFETCH_WINDOW_SECONDS = 75;
const MAX_AGE_MS = 30_000;
const TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 15_000;
const MIN_LINK_LIFETIME_MS = 15_000;

export const watchDataUrl = (seriesId: number, episodeKey: string) =>
    `/api/watch?${new URLSearchParams({ id: String(seriesId), ep: episodeKey })}`;

export const mayPrefetchNextEpisode = (): boolean => {
    if (typeof navigator === "undefined" || typeof document === "undefined") return false;
    const connection = (navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    return document.visibilityState === "visible" && navigator.onLine !== false
        && !connection?.saveData && !["slow-2g", "2g"].includes(connection?.effectiveType ?? "");
};

// One candidate per mounted watch screen, never a global or persistent viewer cache.
export const createNextEpisodePrefetch = ({
    request = (url: string, init: RequestInit) => fetch(url, init),
    now = Date.now,
    allowed = mayPrefetchNextEpisode,
} = {}) => {
    type Entry = {
        key: string;
        controller: AbortController;
        timeout: ReturnType<typeof setTimeout>;
        startedAt: number;
        promise: Promise<WatchData | null>;
    };
    let entry: Entry | null = null;
    let lastAttempt: { key: string; at: number } | null = null;
    const fresh = (data: WatchData, startedAt: number) =>
        now() - startedAt < MAX_AGE_MS && data.playback.expiresAt * 1000 - now() > MIN_LINK_LIFETIME_MS;
    const clear = () => {
        if (entry) {
            clearTimeout(entry.timeout);
            entry.controller.abort();
        }
        entry = null;
        lastAttempt = null;
    };

    return {
        clear,
        async prepare(seriesId: number, episodeKey: string): Promise<void> {
            if (!allowed()) return;
            const key = watchDataUrl(seriesId, episodeKey);
            if (entry?.key === key && now() - entry.startedAt < MAX_AGE_MS) return;
            if (lastAttempt?.key === key && now() - lastAttempt.at < RETRY_DELAY_MS) return;
            clear();
            const controller = new AbortController();
            const startedAt = now();
            lastAttempt = { key, at: startedAt };
            const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
            const next: Entry = {
                key, controller, timeout, startedAt,
                promise: Promise.resolve(null),
            };
            entry = next;
            next.promise = (async () => {
                try {
                    const response = await request(key, {
                        cache: "no-store", credentials: "same-origin", signal: controller.signal, priority: "low",
                    });
                    if (!response.ok || controller.signal.aborted) return null;
                    const data = await response.json() as WatchData;
                    if (controller.signal.aborted || entry !== next || data.seriesId !== seriesId
                        || data.fileName !== episodeKey || !data.playback || !fresh(data, startedAt)) return null;
                    return data;
                } catch {
                    // Speculation must not interrupt the episode currently playing.
                    return null;
                } finally {
                    clearTimeout(timeout);
                }
            })();
            const prepared = await next.promise;
            if (!prepared && entry === next) entry = null;
        },
        async take(seriesId: number, episodeKey: string, signal: AbortSignal): Promise<WatchData | null> {
            const candidate = entry;
            if (!candidate || candidate.key !== watchDataUrl(seriesId, episodeKey) || signal.aborted) return null;
            // The navigation signal now owns the deadline, not the speculative timeout.
            clearTimeout(candidate.timeout);
            // A click joins an in-flight preparation instead of issuing a duplicate request.
            const data = await new Promise<WatchData | null>((resolve) => {
                const abort = () => { candidate.controller.abort(); resolve(null); };
                signal.addEventListener("abort", abort, { once: true });
                void candidate.promise.then((value) => {
                    signal.removeEventListener("abort", abort);
                    resolve(value);
                });
            });
            if (entry !== candidate) return null;
            entry = null;
            if (signal.aborted || candidate.controller.signal.aborted || !data || !fresh(data, candidate.startedAt)) return null;
            return data;
        },
    };
};
