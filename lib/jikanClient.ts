const BASE_URL = process.env.NEXT_PUBLIC_MOVIE_API_URL;

const MIN_REQUEST_INTERVAL_MS = 400;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_RETRIES = 3;

const cache = new Map<string, { data: any; expiresAt: number }>();
let queue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchJikan = async (path: string, options?: RequestInit): Promise<any> => {
    const cached = cache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    let result: any = null;

    const run = queue.then(async () => {
        const elapsed = Date.now() - lastRequestAt;
        if (elapsed < MIN_REQUEST_INTERVAL_MS) {
            await wait(MIN_REQUEST_INTERVAL_MS - elapsed);
        }

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            lastRequestAt = Date.now();

            try {
                const res = await fetch(`${BASE_URL}${path}`, options);

                if (res.status === 429) {
                    await wait(MIN_REQUEST_INTERVAL_MS * (attempt + 2));
                    continue;
                }

                if (!res.ok) return;

                const data = await res.json();
                cache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
                result = data;
                return;
            } catch (error) {
                console.error("fetchJikan error:", error);
                return;
            }
        }
    });

    queue = run.catch(() => {});
    await run;

    return result;
}
