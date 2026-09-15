import { describe, expect, it, vi, beforeEach } from "vitest";

const getCachedResponse = vi.fn();
const setCachedResponse = vi.fn();
const after = vi.fn();
vi.mock("@/lib/providerCache/providerCacheService", () => ({ getCachedResponse, setCachedResponse }));
vi.mock("next/server", () => ({ after }));

const { createRateLimitedClient } = await import("../rateLimitedClient");

const baseConfig = {
    providerId: "tmdb",
    baseUrl: "https://provider.test",
    minRequestIntervalMs: 0,
    cacheTtlMs: 60_000,
    cacheMaxEntries: 100,
    maxRetries: 0,
};

const jsonResponse = (body: unknown, status = 200) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers(),
        json: async () => body,
    }) as Response;

beforeEach(() => {
    vi.clearAllMocks();
    after.mockImplementation(() => { throw new Error("No request context"); });
    getCachedResponse.mockResolvedValue(null);
    setCachedResponse.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", vi.fn());
});

describe("cache miss — pierwsze zapytanie, brak wpisu trwalego", () => {
    it("brak wpisu w cache -> siega do sieci, zapisuje wynik trwale", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ title: "Naruto" }));
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1");

        expect(fetch).toHaveBeenCalledOnce();
        expect(result).toEqual({ kind: "success", data: { title: "Naruto" } });
        expect(setCachedResponse).toHaveBeenCalledWith("tmdb", "/tv/1", { title: "Naruto" }, expect.any(Number));
    });
});

describe("fresh hit — wpis trwaly mlodszy niz TTL", () => {
    it("nie siega do sieci wcale, zwraca dane z cache", async () => {
        getCachedResponse.mockResolvedValue({ data: { title: "Naruto" }, fetchedAtMs: Date.now() - 1_000 });
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1");

        expect(fetch).not.toHaveBeenCalled();
        expect(result).toEqual({ kind: "success", data: { title: "Naruto" } });
    });

    it("drugie wywolanie tej samej sciezki trafia w L1 (pamiec procesu), nawet bez trwalego cache", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ title: "Naruto" }));
        const client = createRateLimitedClient(baseConfig);

        await client.fetchResult("/tv/1");
        await client.fetchResult("/tv/1");

        expect(fetch).toHaveBeenCalledOnce();
        expect(getCachedResponse).toHaveBeenCalledOnce();
    });

    it("respektuje krotszy TTL ustawiony dla konkretnego endpointu", async () => {
        getCachedResponse.mockResolvedValue({ data: { title: "stary" }, fetchedAtMs: Date.now() - 45_000 });
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ title: "nowy" }));
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult(
            "/tv/1",
            undefined,
            undefined,
            { cacheTtlMs: 30_000 },
        );

        expect(fetch).toHaveBeenCalledOnce();
        expect(result).toEqual({ kind: "success", data: { title: "nowy" } });
    });

    it("respektuje dluzszy TTL ustawiony dla konkretnego endpointu", async () => {
        getCachedResponse.mockResolvedValue({ data: { title: "z cache" }, fetchedAtMs: Date.now() - 90_000 });
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult(
            "/tv/1",
            undefined,
            undefined,
            { cacheTtlMs: 120_000 },
        );

        expect(fetch).not.toHaveBeenCalled();
        expect(result).toEqual({ kind: "success", data: { title: "z cache" } });
    });
});

describe("deferred persistent cache", () => {
    const captureWrites = () => {
        const writes: (() => Promise<void>)[] = [];
        after.mockImplementation((write: () => Promise<void>) => { writes.push(write); });
        return writes;
    };

    it("returns provider data before the database write and serves subsequent callers from memory", async () => {
        const writes = captureWrites();
        let finishWrite!: (value: { ok: true }) => void;
        setCachedResponse.mockReturnValueOnce(new Promise((resolve) => { finishWrite = resolve; }));
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ title: "Fresh" }));
        const client = createRateLimitedClient(baseConfig);

        expect(await client.fetchResult("/deferred")).toMatchObject({ kind: "success" });
        expect(setCachedResponse).not.toHaveBeenCalled();
        const write = writes[0]();
        expect(setCachedResponse).toHaveBeenCalledOnce();
        expect(await client.fetchResult("/deferred")).toMatchObject({ kind: "success" });
        expect(fetch).toHaveBeenCalledOnce();
        expect(getCachedResponse).toHaveBeenCalledOnce();
        finishWrite({ ok: true });
        await write;
    });

    it("keeps the original fetch time when the response finishes later", async () => {
        const writes = captureWrites();
        const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
        try {
            vi.mocked(fetch).mockResolvedValue(jsonResponse({ title: "Fresh" }));
            const client = createRateLimitedClient(baseConfig);
            await client.fetchResult("/timestamp");
            clock.mockReturnValue(1_120_000);
            await writes[0]();
            expect(setCachedResponse).toHaveBeenCalledWith("tmdb", "/timestamp", { title: "Fresh" }, 1_000_000);
        } finally {
            clock.mockRestore();
        }
    });

    it("does not replace newer data when response callbacks finish out of order", async () => {
        const writes = captureWrites();
        vi.mocked(fetch)
            .mockResolvedValueOnce(jsonResponse({ version: 1 }))
            .mockResolvedValueOnce(jsonResponse({ version: 2 }));
        const client = createRateLimitedClient({ ...baseConfig, cacheTtlMs: 0 });
        await client.fetchResult("/latest");
        await client.fetchResult("/latest");

        await writes[1]();
        await writes[0]();

        expect(setCachedResponse).toHaveBeenCalledExactlyOnceWith("tmdb", "/latest", { version: 2 }, expect.any(Number));
    });

    it("serializes a newer write behind an already running write of the same key", async () => {
        const writes = captureWrites();
        let finishFirst!: (value: { ok: true }) => void;
        setCachedResponse.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
        vi.mocked(fetch)
            .mockResolvedValueOnce(jsonResponse({ version: 1 }))
            .mockResolvedValueOnce(jsonResponse({ version: 2 }));
        const client = createRateLimitedClient({ ...baseConfig, cacheTtlMs: 0 });
        await client.fetchResult("/ordered");
        const first = writes[0]();
        await client.fetchResult("/ordered");
        const second = writes[1]();
        expect(setCachedResponse).toHaveBeenCalledOnce();
        finishFirst({ ok: true });
        await Promise.all([first, second]);
        expect(setCachedResponse).toHaveBeenNthCalledWith(2, "tmdb", "/ordered", { version: 2 }, expect.any(Number));
    });

    it("does not serialize writes for independent keys", async () => {
        const writes = captureWrites();
        let finishFirst!: (value: { ok: true }) => void;
        setCachedResponse.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; }));
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ title: "Fresh" }));
        const client = createRateLimitedClient(baseConfig);
        await client.fetchResult("/first");
        const first = writes[0]();
        await client.fetchResult("/second");
        await writes[1]();
        expect(setCachedResponse).toHaveBeenCalledTimes(2);
        finishFirst({ ok: true });
        await first;
    });

    it.each([false, true])("isolates cache failures from provider retries and its circuit with deferral %s", async (deferred) => {
        const writes = deferred ? captureWrites() : [];
        setCachedResponse.mockRejectedValue(new Error("Database write failed"));
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ title: "Fresh" }));
        const client = createRateLimitedClient({ ...baseConfig, maxRetries: 3 });

        for (let index = 0; index < 6; index++) {
            expect(await client.fetchResult(`/failure/${index}`)).toMatchObject({ kind: "success" });
            if (deferred) await expect(writes[index]()).resolves.toBeUndefined();
        }

        expect(fetch).toHaveBeenCalledTimes(6);
        expect(setCachedResponse).toHaveBeenCalledTimes(6);
    });

    it("awaits a shared write outside Next request context while callers cancel independently", async () => {
        let finishWrite!: (value: { ok: true }) => void;
        setCachedResponse.mockReturnValueOnce(new Promise((resolve) => { finishWrite = resolve; }));
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ title: "Fresh" }));
        const client = createRateLimitedClient(baseConfig);
        const controller = new AbortController();
        const first = client.fetchResult("/fallback", { signal: controller.signal });
        let secondFinished = false;
        const second = client.fetchResult("/fallback").then((result) => {
            secondFinished = true;
            return result;
        });
        await vi.waitFor(() => expect(setCachedResponse).toHaveBeenCalledOnce());
        controller.abort();
        expect(await first).toMatchObject({ kind: "error", reason: "network" });
        expect(secondFinished).toBe(false);
        finishWrite({ ok: true });
        expect(await second).toMatchObject({ kind: "success" });
        expect(fetch).toHaveBeenCalledOnce();
        expect(setCachedResponse).toHaveBeenCalledOnce();
    });
});

describe("stale hit — wpis trwaly starszy niz TTL, provider odpowiada", () => {
    it("odswieza z sieci i nadpisuje trwaly cache", async () => {
        getCachedResponse.mockResolvedValue({ data: { title: "stary" }, fetchedAtMs: Date.now() - 120_000 });
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ title: "nowy" }));
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1");

        expect(fetch).toHaveBeenCalledOnce();
        expect(result).toEqual({ kind: "success", data: { title: "nowy" } });
        expect(setCachedResponse).toHaveBeenCalledWith("tmdb", "/tv/1", { title: "nowy" }, expect.any(Number));
    });
});

describe("stale-while-error — provider pada, ale jest stary wpis trwaly", () => {
    it("sieć zawodzi (500), zwraca stary wpis zamiast bledu", async () => {
        getCachedResponse.mockResolvedValue({ data: { title: "stary" }, fetchedAtMs: Date.now() - 120_000 });
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1");

        expect(result).toEqual({ kind: "success", data: { title: "stary" } });
    });

    it("brak jakiegokolwiek wpisu trwalego + siec zawodzi -> prawdziwy blad, nie ma czego podac jako stale", async () => {
        getCachedResponse.mockResolvedValue(null);
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1");

        expect(result.kind).toBe("error");
    });
});

describe("uszkodzony payload z providera", () => {
    it("walidator odrzuca ksztalt danych -> traktowane jak blad, stale-while-error nadal dziala", async () => {
        getCachedResponse.mockResolvedValue({ data: { title: "stary" }, fetchedAtMs: Date.now() - 120_000 });
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ nieoczekiwany: "ksztalt" }));
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1", undefined, (value) => typeof value === "object" && value !== null && "title" in value);

        expect(result).toEqual({ kind: "success", data: { title: "stary" } });
        expect(setCachedResponse).not.toHaveBeenCalled();
    });

    it("odpowiedz nie jest poprawnym JSON-em -> blad, bez zapisu do trwalego cache", async () => {
        getCachedResponse.mockResolvedValue(null);
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => { throw new Error("invalid json"); },
        } as unknown as Response);
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1");

        expect(result.kind).toBe("error");
        expect(setCachedResponse).not.toHaveBeenCalled();
    });
});

describe("timeout providera", () => {
    it("blad typu TimeoutError jest traktowany jak kazdy inny blad sieci -- stale-while-error nadal dziala", async () => {
        getCachedResponse.mockResolvedValue({ data: { title: "stary" }, fetchedAtMs: Date.now() - 120_000 });
        const timeoutError = new Error("timeout");
        timeoutError.name = "TimeoutError";
        vi.mocked(fetch).mockRejectedValueOnce(timeoutError);
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1");

        expect(result).toEqual({ kind: "success", data: { title: "stary" } });
    });
});

describe("cancellation", () => {
    it("does not start or retry a request canceled before its network turn", async () => {
        const controller = new AbortController();
        vi.mocked(fetch).mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
            const rejectAbort = () => reject(new DOMException("Aborted", "AbortError"));
            if (options?.signal?.aborted) rejectAbort();
            else options?.signal?.addEventListener("abort", rejectAbort, { once: true });
        }));
        const client = createRateLimitedClient({ ...baseConfig, maxRetries: 2 });
        const pending = client.fetchResult("/search", { signal: controller.signal });
        controller.abort();

        await expect(pending).resolves.toMatchObject({ kind: "error", reason: "network" });
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe("shared request cancellation", () => {
    it.each([0, 1])("canceling subscriber %i preserves the other subscriber's response", async (canceledIndex) => {
        let finish!: (response: Response) => void;
        let upstream!: AbortSignal;
        vi.mocked(fetch).mockImplementationOnce((_url, options) => {
            upstream = options!.signal!;
            return new Promise((resolve, reject) => {
                finish = resolve;
                upstream.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
            });
        });
        const client = createRateLimitedClient(baseConfig);
        const controllers = [new AbortController(), new AbortController()];
        const requests = controllers.map((controller) => client.fetchResult("/shared", { signal: controller.signal }));
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        controllers[canceledIndex].abort();
        expect(await requests[canceledIndex]).toMatchObject({ kind: "error", reason: "network" });
        expect(upstream.aborted).toBe(false);
        finish(jsonResponse({ title: "Shared" }));
        expect(await requests[1 - canceledIndex]).toEqual({ kind: "success", data: { title: "Shared" } });
        expect(fetch).toHaveBeenCalledOnce();
    });

    it("keeps a shared configuration request alive for callers without a signal", async () => {
        let finish!: (response: Response) => void;
        let upstream!: AbortSignal;
        vi.mocked(fetch).mockImplementationOnce((_url, options) => {
            upstream = options!.signal!;
            return new Promise((resolve) => { finish = resolve; });
        });
        const controller = new AbortController();
        const client = createRateLimitedClient(baseConfig);
        const search = client.fetchResult("/configuration", { signal: controller.signal });
        const artwork = client.fetchResult("/configuration");
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        controller.abort();
        expect(await search).toMatchObject({ kind: "error" });
        expect(upstream.aborted).toBe(false);
        finish(jsonResponse({ images: {} }));
        expect(await artwork).toMatchObject({ kind: "success" });
    });

    it("aborts the upstream only after the last subscriber leaves and permits a fresh request", async () => {
        const responses: ((response: Response) => void)[] = [];
        const signals: AbortSignal[] = [];
        vi.mocked(fetch).mockImplementation((_url, options) => {
            signals.push(options!.signal!);
            return new Promise((resolve) => { responses.push(resolve); });
        });
        const client = createRateLimitedClient(baseConfig);
        const first = new AbortController();
        const second = new AbortController();
        const oldRequests = [client.fetchResult("/same", { signal: first.signal }), client.fetchResult("/same", { signal: second.signal })];
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        first.abort();
        expect(signals[0].aborted).toBe(false);
        second.abort();
        expect(signals[0].aborted).toBe(true);
        await Promise.all(oldRequests);
        const fresh = client.fetchResult("/same");
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        responses[0](jsonResponse({ title: "Old" }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        const joined = client.fetchResult("/same");
        responses[1](jsonResponse({ title: "Fresh" }));
        expect(await fresh).toEqual({ kind: "success", data: { title: "Fresh" } });
        expect(await joined).toEqual({ kind: "success", data: { title: "Fresh" } });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(setCachedResponse).toHaveBeenCalledExactlyOnceWith("tmdb", "/same", { title: "Fresh" }, expect.any(Number));
    });

    it("does not open the provider circuit for canceled response bodies", async () => {
        const response = Response.json({});
        vi.spyOn(response, "json").mockRejectedValue(new DOMException("Aborted", "AbortError"));
        vi.mocked(fetch).mockResolvedValue(response);
        const client = createRateLimitedClient({ ...baseConfig, maxRetries: 3 });
        for (let index = 0; index < 5; index++) {
            expect(await client.fetchResult(`/canceled-body/${index}`)).toMatchObject({ kind: "error", reason: "network" });
        }
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ healthy: true }));
        expect(await client.fetchResult("/healthy")).toMatchObject({ kind: "success" });
        expect(fetch).toHaveBeenCalledTimes(6);
    });

    it("cancels a long Retry-After delay without another provider call", async () => {
        vi.useFakeTimers();
        try {
            const response = jsonResponse({}, 429);
            response.headers.set("Retry-After", "60");
            vi.mocked(fetch).mockResolvedValue(response);
            const controller = new AbortController();
            const client = createRateLimitedClient({ ...baseConfig, maxRetries: 3 });
            const request = client.fetchResult("/limited", { signal: controller.signal });
            await vi.advanceTimersByTimeAsync(0);
            expect(fetch).toHaveBeenCalledOnce();
            controller.abort();
            expect(await request).toMatchObject({ kind: "error", reason: "network" });
            await vi.advanceTimersByTimeAsync(60_000);
            expect(fetch).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("limit prob dla konkretnego endpointu", () => {
    it("obniza liczbe podejsc ponizej globalnego limitu", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 500));
        const client = createRateLimitedClient({ ...baseConfig, maxRetries: 3 });

        const result = await client.fetchResult("/tv/1", undefined, undefined, { maxRetries: 1 });

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(result.kind).toBe("error");
    });

    it("nie moze podniesc globalnego limitu prob", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 429));
        const client = createRateLimitedClient({ ...baseConfig, maxRetries: 1 });

        await client.fetchResult("/tv/1", undefined, undefined, { maxRetries: 9 });

        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe("rownolegly miss tego samego klucza", () => {
    it("dwa rownoczesne zapytania o ta sama sciezke wywoluja siec tylko raz", async () => {
        let resolveFetch: (value: Response) => void = () => {};
        vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));
        const client = createRateLimitedClient(baseConfig);

        const first = client.fetchResult("/tv/1");
        const second = client.fetchResult("/tv/1");

        resolveFetch(jsonResponse({ title: "Naruto" }));
        const [firstResult, secondResult] = await Promise.all([first, second]);

        expect(fetch).toHaveBeenCalledOnce();
        expect(firstResult).toEqual(secondResult);
    });

    it("rownolegle zapytania o RÓŻNE sciezki nie sa ze soba deduplikowane", async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(jsonResponse({ title: "A" }))
            .mockResolvedValueOnce(jsonResponse({ title: "B" }));
        const client = createRateLimitedClient(baseConfig);

        await Promise.all([client.fetchResult("/tv/1"), client.fetchResult("/tv/2")]);

        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe("circuit breaker", () => {
    it("po 5 kolejnych porazkach otwiera obwod i pomija siec dla kolejnych zapytan", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 500));
        const client = createRateLimitedClient(baseConfig);

        for (let i = 0; i < 5; i++) {
            await client.fetchResult(`/tv/${i}`);
        }

        expect(fetch).toHaveBeenCalledTimes(5);

        const result = await client.fetchResult("/tv/circuit-open");
        expect(fetch).toHaveBeenCalledTimes(5);
        expect(result.kind).toBe("error");
    });

    it("obwod otwarty ale jest stary wpis trwaly dla akurat tej sciezki -> nadal serwuje stale, mimo pominietej sieci", async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 500));
        const client = createRateLimitedClient(baseConfig);

        for (let i = 0; i < 5; i++) {
            await client.fetchResult(`/tv/${i}`);
        }

        getCachedResponse.mockResolvedValue({ data: { title: "stary" }, fetchedAtMs: Date.now() - 120_000 });
        const result = await client.fetchResult("/tv/after-circuit-open");

        expect(fetch).toHaveBeenCalledTimes(5);
        expect(result).toEqual({ kind: "success", data: { title: "stary" } });
    });

    it("sukces resetuje licznik porazek", async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
            .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
            .mockResolvedValueOnce(jsonResponse({ title: "ok" }))
            .mockResolvedValue(jsonResponse({ error: "boom" }, 500));
        const client = createRateLimitedClient(baseConfig);

        await client.fetchResult("/tv/1");
        await client.fetchResult("/tv/2");
        await client.fetchResult("/tv/3");

        for (let i = 4; i < 8; i++) {
            await client.fetchResult(`/tv/${i}`);
        }
        expect(fetch).toHaveBeenCalledTimes(7);

        const result = await client.fetchResult("/tv/9");
        expect(fetch).toHaveBeenCalledTimes(8);
        expect(result.kind).toBe("error");
    });
});
