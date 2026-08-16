import { describe, expect, it, vi, beforeEach } from "vitest";

const getCachedResponse = vi.fn();
const setCachedResponse = vi.fn();
vi.mock("@/lib/providerCache/providerCacheService", () => ({ getCachedResponse, setCachedResponse }));

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
        expect(setCachedResponse).toHaveBeenCalledWith("tmdb", "/tv/1", { title: "Naruto" });
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

describe("stale hit — wpis trwaly starszy niz TTL, provider odpowiada", () => {
    it("odswieza z sieci i nadpisuje trwaly cache", async () => {
        getCachedResponse.mockResolvedValue({ data: { title: "stary" }, fetchedAtMs: Date.now() - 120_000 });
        vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ title: "nowy" }));
        const client = createRateLimitedClient(baseConfig);

        const result = await client.fetchResult("/tv/1");

        expect(fetch).toHaveBeenCalledOnce();
        expect(result).toEqual({ kind: "success", data: { title: "nowy" } });
        expect(setCachedResponse).toHaveBeenCalledWith("tmdb", "/tv/1", { title: "nowy" });
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
