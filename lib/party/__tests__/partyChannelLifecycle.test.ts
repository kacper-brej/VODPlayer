import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock("react", () => ({
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
    useRef: (current: unknown) => ({ current }),
    useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
}));
vi.mock("@/lib/party/loadPartyClock", () => ({ loadPartyClock: async () => null }));

import { usePartySync } from "../usePartySync";

const grant = () => Response.json({ streamUrl: "https://stream.example.test/room", expiresAtMs: Date.now() + 300_000 });
let cleanups: (() => void)[] = [];
const Harness = () => {
    usePartySync("ROOM42");
    return null;
};
const mount = () => {
    Harness();
    cleanups = hooks.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === "function");
};
const unmount = () => { cleanups.forEach((cleanup) => cleanup()); cleanups = []; };

beforeEach(() => {
    hooks.effects = [];
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", vi.fn(function () { return { close: vi.fn(), addEventListener: vi.fn() }; }));
});

afterEach(() => {
    unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("party channel lifecycle", () => {
    it.each(["headers", "body"])("ignores a late channel grant after unmount while waiting for %s", async (phase) => {
        let finish!: (value: never) => void;
        let requestSignal!: AbortSignal;
        vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
            if (!url.endsWith("/channel-token")) return Promise.resolve(Response.json({}));
            requestSignal = options!.signal!;
            if (phase === "headers") return new Promise<Response>((resolve) => { finish = resolve; });
            return Promise.resolve({ ok: true, json: () => new Promise((resolve) => { finish = resolve; }) } as Response);
        }));
        mount();
        await vi.advanceTimersByTimeAsync(0);
        unmount();
        expect(requestSignal.aborted).toBe(true);
        finish((phase === "headers" ? grant() : { streamUrl: "https://stream.example.test/room", expiresAtMs: Date.now() + 300_000 }) as never);
        await vi.advanceTimersByTimeAsync(0);
        expect(EventSource).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("closes an established connection and removes its renewal timer on unmount", async () => {
        vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.endsWith("/channel-token") ? grant() : Response.json({}))));
        mount();
        await vi.advanceTimersByTimeAsync(0);
        expect(EventSource).toHaveBeenCalledExactlyOnceWith("https://stream.example.test/room");
        const source = vi.mocked(EventSource).mock.results[0].value;
        unmount();
        expect(source.close).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("retries a timed-out token request without leaving an open connection", async () => {
        const requests: AbortSignal[] = [];
        vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
            if (!url.endsWith("/channel-token")) return Promise.resolve(Response.json({}));
            requests.push(options!.signal!);
            return new Promise<Response>((_resolve, reject) => options!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
        }));
        mount();
        await vi.advanceTimersByTimeAsync(9_000);
        expect(requests).toHaveLength(2);
        expect(requests[0].aborted).toBe(true);
        expect(requests[1].aborted).toBe(false);
        expect(EventSource).not.toHaveBeenCalled();
    });
});
