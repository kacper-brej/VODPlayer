import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPartyClock } from "../loadPartyClock";

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("party clock sampling", () => {
    it("collects all seven samples with at most two requests at once and preserves the offset", async () => {
        let active = 0;
        let maximum = 0;
        let count = 0;
        vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => {
            const index = count++;
            const sent = Date.now();
            const rtt = index === 3 ? 1_000 : 100;
            active += 1;
            maximum = Math.max(maximum, active);
            return new Promise<Response>((resolve, reject) => {
                const timer = setTimeout(() => {
                    active -= 1;
                    resolve(Response.json({ serverNowMs: sent + rtt / 2 + (index === 3 ? 2_600 : 2_000) }));
                }, rtt);
                options.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
            });
        }));
        const result = loadPartyClock(new AbortController().signal);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(await result).toEqual({ offsetMs: 2_000, medianRttMs: 100, samplesUsed: 6, samplesDiscarded: 1 });
        expect(count).toBe(7);
        expect(maximum).toBe(2);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("finishes stable samples in four rounds instead of seven", async () => {
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
            const sent = Date.now();
            setTimeout(() => resolve(Response.json({ serverNowMs: sent + 50 + 2_000 })), 100);
        })));
        const result = loadPartyClock(new AbortController().signal);
        await vi.advanceTimersByTimeAsync(400);
        expect(await result).toMatchObject({ offsetMs: 2_000, samplesUsed: 7 });
        expect(fetch).toHaveBeenCalledTimes(7);
    });

    it("aborts in-flight requests and stops scheduling when the viewer leaves", async () => {
        const signals: AbortSignal[] = [];
        vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
            signals.push(options.signal!);
            options.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        })));
        const controller = new AbortController();
        const result = loadPartyClock(controller.signal);
        controller.abort();
        expect(await result).toBeNull();
        expect(signals).toHaveLength(2);
        expect(signals.every((signal) => signal.aborted)).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("bounds stalled requests and rejects an estimate with no usable samples", async () => {
        vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
            options.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        })));
        const result = loadPartyClock(new AbortController().signal);
        await vi.advanceTimersByTimeAsync(20_000);
        expect(await result).toBeNull();
        expect(fetch).toHaveBeenCalledTimes(7);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("does not start already-canceled sampling", async () => {
        vi.stubGlobal("fetch", vi.fn());
        const controller = new AbortController();
        controller.abort();
        expect(await loadPartyClock(controller.signal)).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });
});
