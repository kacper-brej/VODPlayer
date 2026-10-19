import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNextEpisodePrefetch, mayPrefetchNextEpisode, watchDataUrl } from "../nextEpisodePrefetch";
import type { WatchData } from "../watchData";

let now: number;
const data = (patch: Partial<WatchData> = {}): WatchData => ({
    seriesId: 1, seriesKey: "Series", fileName: "2.mp4", currentEpisode: 2,
    startTime: 27, chapters: [{ type: "intro", startSeconds: 0, endSeconds: 90 }],
    playback: { kind: "hls", src: "/api/hls?test", heights: [720], expiresAt: (now + 90_000) / 1000 },
    ...patch,
} as WatchData);
const response = (value = data()) => Response.json(value);
const signal = () => new AbortController().signal;
const delayedRequest = (delayMs: number) => vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    const requestSignal = init.signal!;
    const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
        requestSignal.removeEventListener("abort", abort);
        resolve(response());
    }, delayMs);
    requestSignal.addEventListener("abort", abort, { once: true });
    if (requestSignal.aborted) abort();
}));
beforeEach(() => { now = 1_000_000; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("next episode preparation", () => {
    it("reuses a prepared episode once, including its own resume point and chapters", async () => {
        const request = vi.fn(async () => response());
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        await cache.prepare(1, "2.mp4");
        await cache.prepare(1, "2.mp4");
        expect(request).toHaveBeenCalledTimes(1);
        expect(request).toHaveBeenCalledWith(watchDataUrl(1, "2.mp4"), expect.objectContaining({ cache: "no-store", credentials: "same-origin", priority: "low" }));
        expect(await cache.take(1, "2.mp4", signal())).toMatchObject({ fileName: "2.mp4", startTime: 27, chapters: [{ type: "intro" }] });
        expect(await cache.take(1, "2.mp4", signal())).toBeNull();
    });
    it("joins an in-flight request without another fetch", async () => {
        let finish!: (response: Response) => void;
        const request = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        const prepare = cache.prepare(1, "2.mp4");
        const take = cache.take(1, "2.mp4", signal());
        finish(response());
        await prepare;
        expect(await take).not.toBeNull();
        expect(request).toHaveBeenCalledTimes(1);
    });
    it.each([0, 7_999])("lets a 10-second response finish when navigation takes over after %i ms", async (clickDelay) => {
        const request = delayedRequest(10_000);
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        const prepare = cache.prepare(1, "2.mp4");
        await vi.advanceTimersByTimeAsync(clickDelay);
        const controller = new AbortController();
        const navigationTimeout = setTimeout(() => controller.abort(), 15_000);
        const take = cache.take(1, "2.mp4", controller.signal);

        await vi.advanceTimersByTimeAsync(10_000 - clickDelay);
        await prepare;
        expect(await take).toMatchObject({ fileName: "2.mp4", startTime: 27 });
        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0][1].signal!.aborted).toBe(false);
        clearTimeout(navigationTimeout);
        expect(vi.getTimerCount()).toBe(0);
    });
    it("still cancels a promoted request at the navigation deadline measured from the click", async () => {
        const request = delayedRequest(30_000);
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        const prepare = cache.prepare(1, "2.mp4");
        await vi.advanceTimersByTimeAsync(7_999);
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 15_000);
        const take = cache.take(1, "2.mp4", controller.signal);

        await vi.advanceTimersByTimeAsync(14_999);
        expect(request.mock.calls[0][1].signal!.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(request.mock.calls[0][1].signal!.aborted).toBe(true);
        expect(await take).toBeNull();
        await prepare;
        expect(request).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });
    it.each(["different episode", "aborted navigation"])("keeps the speculative timeout when take is rejected: %s", async (reason) => {
        const request = delayedRequest(30_000);
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        const prepare = cache.prepare(1, "2.mp4");
        const controller = new AbortController();
        if (reason === "aborted navigation") controller.abort();

        expect(await cache.take(1, reason === "different episode" ? "3.mp4" : "2.mp4", controller.signal)).toBeNull();
        await vi.advanceTimersByTimeAsync(8_000);
        expect(request.mock.calls[0][1].signal!.aborted).toBe(true);
        await prepare;
        expect(vi.getTimerCount()).toBe(0);
    });
    it.each([30_000, 80_000])("ignores old data and expiring links after %i ms", async (elapsed) => {
        const cache = createNextEpisodePrefetch({ request: async () => response(), now: () => now, allowed: () => true });
        await cache.prepare(1, "2.mp4");
        now += elapsed;
        expect(await cache.take(1, "2.mp4", signal())).toBeNull();
    });
    it("rejects a link with less than 15 seconds of validity", async () => {
        const cache = createNextEpisodePrefetch({ request: async () => response(data({ playback: { kind: "file", src: "/file", expiresAt: (now + 10_000) / 1000 } })), now: () => now, allowed: () => true });
        await cache.prepare(1, "2.mp4");
        expect(await cache.take(1, "2.mp4", signal())).toBeNull();
    });
    it.each([401, 403, 404, 503])("silently falls back after HTTP %i", async (status) => {
        const request = vi.fn(async () => new Response(null, { status }));
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        await cache.prepare(1, "2.mp4");
        expect(await cache.take(1, "2.mp4", signal())).toBeNull();
        await cache.prepare(1, "2.mp4");
        expect(request).toHaveBeenCalledTimes(1);
        now += 15_001;
        await cache.prepare(1, "2.mp4");
        expect(request).toHaveBeenCalledTimes(2);
    });
    it("does not mix series, episodes or separate watch screens", async () => {
        const create = () => createNextEpisodePrefetch({ request: async () => response(), now: () => now, allowed: () => true });
        const a = create(), b = create();
        await a.prepare(1, "2.mp4");
        expect(await a.take(2, "2.mp4", signal())).toBeNull();
        expect(await a.take(1, "3.mp4", signal())).toBeNull();
        expect(await b.take(1, "2.mp4", signal())).toBeNull();
        expect(await a.take(1, "2.mp4", signal())).not.toBeNull();
    });
    it("discards late responses after the screen is cleared", async () => {
        let finish!: (response: Response) => void;
        let requestSignal: AbortSignal | null | undefined;
        const request = vi.fn((_url: string, init: RequestInit) => {
            requestSignal = init.signal;
            return new Promise<Response>((resolve) => { finish = resolve; });
        });
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        const prepare = cache.prepare(1, "2.mp4");
        const take = cache.take(1, "2.mp4", signal());
        cache.clear();
        finish(response());
        await prepare;
        expect(await take).toBeNull();
        expect(requestSignal?.aborted).toBe(true);
    });
    it("cancels an in-flight preparation when navigation is aborted", async () => {
        const request = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }));
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        const prepare = cache.prepare(1, "2.mp4");
        const controller = new AbortController();
        const take = cache.take(1, "2.mp4", controller.signal);
        controller.abort();
        expect(await take).toBeNull();
        await prepare;
    });
    it("times out speculative requests and never throws to the current player", async () => {
        const request = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }));
        const cache = createNextEpisodePrefetch({ request, now: () => now, allowed: () => true });
        const prepare = cache.prepare(1, "2.mp4");
        await vi.advanceTimersByTimeAsync(8_000);
        await expect(prepare).resolves.toBeUndefined();
        expect(await cache.take(1, "2.mp4", signal())).toBeNull();
    });
    it("makes no requests when preparation is disabled", async () => {
        const request = vi.fn();
        const cache = createNextEpisodePrefetch({ request, allowed: () => false });
        await cache.prepare(1, "2.mp4");
        expect(request).not.toHaveBeenCalled();
    });
});

describe("prefetch connection policy", () => {
    it.each([
        ["visible", true, {}, true],
        ["hidden", true, {}, false],
        ["visible", false, {}, false],
        ["visible", true, { saveData: true }, false],
        ["visible", true, { effectiveType: "2g" }, false],
        ["visible", true, { effectiveType: "slow-2g" }, false],
    ])("respects visibility/connectivity/data saving %#", (visibilityState, onLine, connection, expected) => {
        vi.stubGlobal("document", { visibilityState });
        vi.stubGlobal("navigator", { onLine, connection });
        expect(mayPrefetchNextEpisode()).toBe(expected);
    });
});
