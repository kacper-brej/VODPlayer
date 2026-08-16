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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const pending = new Map<string, Promise<DataResult<unknown>>>();
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

    const scheduleStart = () => {
        const turn = schedule.then(async () => {
            const elapsed = Date.now() - lastRequestAt;
            if (elapsed < config.minRequestIntervalMs) {
                await wait(config.minRequestIntervalMs - elapsed);
            }
            lastRequestAt = Date.now();
        });

        schedule = turn;
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
    ): Promise<DataResult<unknown>> => {
        await scheduleStart();

        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                const res = await fetch(`${config.baseUrl}${path}`, {
                    ...options,
                    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
                });

                if (res.status === 429 || res.status >= 500) {
                    if (attempt < config.maxRetries) {
                        const delay = res.status === 429
                            ? retryAfterMs(res) ?? config.minRequestIntervalMs * (attempt + 2)
                            : config.minRequestIntervalMs * (attempt + 2);
                        await wait(delay);
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
                } catch {
                    recordFailure();
                    return dataFailure("invalid_response");
                }

                if (validator && !validator(data)) {
                    recordFailure();
                    return dataFailure("invalid_response");
                }

                recordSuccess();
                writeLocalCache(path, data);
                await writePersistentCache(config.providerId, path, data);
                return dataSuccess(data);
            } catch (error) {
                const timedOut = error instanceof Error && error.name === "TimeoutError";
                console.error(`rateLimitedClient[${config.providerId}] request failed:`, timedOut ? "timeout" : error);

                if (attempt < config.maxRetries) {
                    await wait(config.minRequestIntervalMs * (attempt + 2));
                    continue;
                }

                recordFailure();
                return dataFailure("network");
            }
        }

        recordFailure();
        return dataFailure("server");
    };

    const fetchResult = async (
        path: string,
        options?: RequestInit,
        validator?: (value: unknown) => boolean,
        requestConfig?: RateLimitedRequestConfig,
    ): Promise<DataResult<unknown>> => {
        const cacheTtlMs = requestConfig?.cacheTtlMs ?? config.cacheTtlMs;
        const cachedLocal = readLocalCache(path, cacheTtlMs);
        if (cachedLocal !== null) {
            return dataSuccess(cachedLocal);
        }

        const inFlight = pending.get(path);
        if (inFlight) {
            return inFlight;
        }

        const run = (async () => {
            const persisted = await readPersistentCache(config.providerId, path);
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
                : await attemptNetwork(path, options, validator);

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

        pending.set(path, run);
        run.finally(() => pending.delete(path));

        return run;
    };

    return { fetchResult };
};
