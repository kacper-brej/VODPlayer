import {
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

const BASE_URL = process.env.NEXT_PUBLIC_MOVIE_API_URL;

const MIN_REQUEST_INTERVAL_MS = 400;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_RETRIES = 3;

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const pending = new Map<string, Promise<DataResult<unknown>>>();
let schedule: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const scheduleStart = () => {
    const turn = schedule.then(async () => {
        const elapsed = Date.now() - lastRequestAt;
        if (elapsed < MIN_REQUEST_INTERVAL_MS) {
            await wait(MIN_REQUEST_INTERVAL_MS - elapsed);
        }
        lastRequestAt = Date.now();
    });

    schedule = turn;
    return turn;
};

export const fetchJikanResult = async (
    path: string,
    options?: RequestInit,
): Promise<DataResult<unknown>> => {
    const cached = cache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
        return dataSuccess(cached.data);
    }

    const inFlight = pending.get(path);
    if (inFlight) {
        return inFlight;
    }

    const run = (async () => {
        await scheduleStart();

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await fetch(`${BASE_URL}${path}`, options);

                if (res.status === 429 || res.status >= 500) {
                    if (attempt < MAX_RETRIES) {
                        await wait(MIN_REQUEST_INTERVAL_MS * (attempt + 2));
                        continue;
                    }
                    console.error("fetchJikan failed after retries:", path, res.status);
                    return failureFromStatus(res.status);
                }

                if (!res.ok) return failureFromStatus(res.status);

                let data: unknown;

                try {
                    data = await res.json();
                } catch {
                    return dataFailure("invalid_response");
                }

                cache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
                return dataSuccess(data);
            } catch (error) {
                console.error("Jikan request failed:", error);
                return dataFailure("network");
            }
        }

        return dataFailure("server");
    })();

    pending.set(path, run);
    run.finally(() => pending.delete(path));

    return run;
}
