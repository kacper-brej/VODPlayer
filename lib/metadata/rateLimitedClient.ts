import "server-only";
import {
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/core/dataResult";
import { getCachedResponse, setCachedResponse } from "@/lib/providerCache/providerCacheService";

export interface RateLimitedClientConfig {
    providerId: string;
    baseUrl: string;
    minRequestIntervalMs: number;
    cacheTtlMs: number;
    cacheMaxEntries: number;
    maxRetries: number;
}

export interface RateLimitedRequestConfig {
    cacheTtlMs?: number;
    maxRetries?: number;
}

export interface RateLimitedClient {
    fetchResult: (
        path: string,
        options?: RequestInit,
        validator?: (value: unknown) => boolean,
        requestConfig?: RateLimitedRequestConfig,
    ) => Promise<DataResult<unknown>>;
}

const NETWORK_TIMEOUT_MS = 8_000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

const wait = (ms: number, signal: AbortSignal): Promise<boolean> => new Promise((resolve) => {
    if (signal.aborted) {
        resolve(false);
        return;
    }

    const finish = (completed: boolean) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve(completed);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal.addEventListener("abort", onAbort, { once: true });
});

const retryAfterMs = (res: Response): number | null => {
    const header = res.headers.get("Retry-After");
    if (!header) return null;

    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

    const dateMs = Date.parse(header);
    return Number.isNaN(dateMs) ? null : Math.max(0, dateMs - Date.now());
};

interface PersistedEntry {
    data: unknown;
    fetchedAt: number;
}

interface PendingRequest {
    promise: Promise<DataResult<unknown>>;
    controller: AbortController;
    subscribers: number;
    settled: boolean;
}

const readPersistentCache = async (providerId: string, path: string): Promise<PersistedEntry | null> => {
    const cached = await getCachedResponse(providerId, path);
    return cached ? { data: cached.data, fetchedAt: cached.fetchedAtMs } : null;
};

const writePersistentCache = async (providerId: string, path: string, data: unknown): Promise<void> => {
    const result = await setCachedResponse(providerId, path, data);
    if (!result.ok) {
        console.error(`providerCache[${providerId}]: zapis odrzucony (${result.code})`, path);
    }
};

export const createRateLimitedClient = (config: RateLimitedClientConfig): RateLimitedClient => {
    const cache = new Map<string, { data: unknown; fetchedAt: number }>();
    const pending = new Map<string, PendingRequest>();
    let schedule: Promise<void> = Promise.resolve();
    let lastRequestAt = 0;
    let consecutiveFailures = 0;
    let circuitOpenUntil = 0;

    const pruneCache = () => {
        while (cache.size >= config.cacheMaxEntries) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey === undefined) break;
            cache.delete(oldestKey);
        }
    };

    const readLocalCache = (path: string, cacheTtlMs: number) => {
        const entry = cache.get(path);

        if (!entry) return null;
        if (Date.now() - entry.fetchedAt >= cacheTtlMs) {
            cache.delete(path);
            return null;
        }

        cache.delete(path);
        cache.set(path, entry);
        return entry.data;
    };

    const writeLocalCache = (path: string, data: unknown, fetchedAt = Date.now()) => {
        pruneCache();
        cache.set(path, { data, fetchedAt });
    };

    const scheduleStart = (signal: AbortSignal) => {
        const turn = schedule.then(async () => {
            if (signal.aborted) return false;
            const elapsed = Date.now() - lastRequestAt;
            if (elapsed < config.minRequestIntervalMs) {
                if (!await wait(config.minRequestIntervalMs - elapsed, signal)) return false;
            }
            if (signal.aborted) return false;
            lastRequestAt = Date.now();
            return true;
        });

        schedule = turn.then(() => {});
        return turn;
    };

    const recordSuccess = () => {
        consecutiveFailures = 0;
        circuitOpenUntil = 0;
    };

    const recordFailure = () => {
        consecutiveFailures += 1;
        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
            console.error(
                `rateLimitedClient[${config.providerId}] circuit opened after ${consecutiveFailures} consecutive failures, cooling down ${CIRCUIT_BREAKER_COOLDOWN_MS}ms`,
            );
        }
    };

    const attemptNetwork = async (
        path: string,
        options: RequestInit | undefined,
        validator: ((value: unknown) => boolean) | undefined,
        maxRetries: number,
        requestSignal: AbortSignal,
    ): Promise<DataResult<unknown>> => {
        if (!await scheduleStart(requestSignal)) return dataFailure("network");

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const timeoutSignal = AbortSignal.timeout(NETWORK_TIMEOUT_MS);
                const signal = AbortSignal.any([requestSignal, timeoutSignal]);
                signal.throwIfAborted();
                const res = await fetch(`${config.baseUrl}${path}`, {
                    ...options,
                    signal,
                });
                signal.throwIfAborted();

                if (res.status === 429 || res.status >= 500) {
                    if (attempt < maxRetries) {
                        const delay = res.status === 429
                            ? retryAfterMs(res) ?? config.minRequestIntervalMs * (attempt + 2)
                            : config.minRequestIntervalMs * (attempt + 2);
                        if (!await wait(delay, requestSignal)) return dataFailure("network");
                        continue;
                    }
                    console.error("rateLimitedClient request failed after retries:", path, res.status);
                    recordFailure();
                    return failureFromStatus(res.status);
                }

                if (!res.ok) {
                    recordFailure();
                    return failureFromStatus(res.status);
                }

                let data: unknown;

                try {
                    data = await res.json();
                } catch (error) {
                    signal.throwIfAborted();
                    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
                        throw error;
                    }
                    recordFailure();
                    return dataFailure("invalid_response");
                }

                signal.throwIfAborted();

                if (validator && !validator(data)) {
                    recordFailure();
                    return dataFailure("invalid_response");
                }

                recordSuccess();
                writeLocalCache(path, data);
                await writePersistentCache(config.providerId, path, data);
                return dataSuccess(data);
            } catch (error) {
                if (requestSignal.aborted || (error instanceof Error && error.name === "AbortError")) {
                    return dataFailure("network");
                }
                const timedOut = error instanceof Error && error.name === "TimeoutError";
                console.error(`rateLimitedClient[${config.providerId}] request failed:`, timedOut ? "timeout" : error);

                if (attempt < maxRetries) {
                    if (!await wait(config.minRequestIntervalMs * (attempt + 2), requestSignal)) return dataFailure("network");
                    continue;
                }

                recordFailure();
                return dataFailure("network");
            }
        }

        recordFailure();
        return dataFailure("server");
    };

    const subscribe = (path: string, entry: PendingRequest, signal?: AbortSignal | null): Promise<DataResult<unknown>> => {
        entry.subscribers += 1;

        return new Promise((resolve, reject) => {
            let finished = false;
            const release = () => {
                if (finished) return false;
                finished = true;
                signal?.removeEventListener("abort", onAbort);
                entry.subscribers -= 1;
                return true;
            };
            const onAbort = () => {
                if (!release()) return;
                resolve(dataFailure("network"));

                if (entry.subscribers === 0 && !entry.settled) {
                    if (pending.get(path) === entry) pending.delete(path);
                    entry.controller.abort();
                }
            };

            signal?.addEventListener("abort", onAbort, { once: true });
            if (signal?.aborted) onAbort();

            entry.promise.then(
                (result) => {
                    if (release()) resolve(result);
                },
                (error) => {
                    if (release()) reject(error);
                },
            );
        });
    };

    const fetchResult = async (
        path: string,
        options?: RequestInit,
        validator?: (value: unknown) => boolean,
        requestConfig?: RateLimitedRequestConfig,
    ): Promise<DataResult<unknown>> => {
        if (options?.signal?.aborted) return dataFailure("network");
        const cacheTtlMs = requestConfig?.cacheTtlMs ?? config.cacheTtlMs;
        const maxRetries = Math.max(0, Math.min(config.maxRetries, requestConfig?.maxRetries ?? config.maxRetries));
        const cachedLocal = readLocalCache(path, cacheTtlMs);
        if (cachedLocal !== null) {
            return dataSuccess(cachedLocal);
        }

        const inFlight = pending.get(path);
        if (inFlight) {
            return subscribe(path, inFlight, options?.signal);
        }

        const controller = new AbortController();
        const run = (async () => {
            const persisted = await readPersistentCache(config.providerId, path);
            if (controller.signal.aborted) return dataFailure("network");
            const now = Date.now();

            if (persisted !== null && now - persisted.fetchedAt < cacheTtlMs) {
                writeLocalCache(path, persisted.data, persisted.fetchedAt);
                return dataSuccess(persisted.data);
            }

            const circuitOpen = now < circuitOpenUntil;

            if (circuitOpen) {
                console.error(
                    `rateLimitedClient[${config.providerId}] circuit open, skipping network for`,
                    path,
                );
            }

            const result = circuitOpen
                ? dataFailure("network")
                : await attemptNetwork(path, options, validator, maxRetries, controller.signal);

            if (controller.signal.aborted) return dataFailure("network");

            if (result.kind !== "error") {
                return result;
            }

            if (persisted !== null) {
                console.error(
                    `rateLimitedClient[${config.providerId}] serving stale cache for`,
                    path,
                    "age(ms)=",
                    now - persisted.fetchedAt,
                );
                writeLocalCache(path, persisted.data, persisted.fetchedAt);
                return dataSuccess(persisted.data);
            }

            return result;
        })();

        const entry: PendingRequest = { promise: run, controller, subscribers: 0, settled: false };
        pending.set(path, entry);
        const settle = () => {
            entry.settled = true;
            if (pending.get(path) === entry) pending.delete(path);
        };
        run.then(settle, settle);

        return subscribe(path, entry, options?.signal);
    };

    return { fetchResult };
};
