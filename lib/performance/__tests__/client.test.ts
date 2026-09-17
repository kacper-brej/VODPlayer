import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_PERFORMANCE_SAMPLE_RATE", "1");
    vi.stubGlobal("window", { location: { href: "https://example.test/watch?secret=1", pathname: "/watch" }, matchMedia: () => ({ matches: true }) });
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => true) });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("performance transport", () => {
    it("batches and replaces updates without leaking a page URL", async () => {
        const client = await import("../client");
        client.reportPerformanceSample({ id: "1", name: "LCP", value: 100 });
        client.reportPerformanceSample({ id: "1", name: "LCP", value: 200 });
        expect(navigator.sendBeacon).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(15000);
        const blob = vi.mocked(navigator.sendBeacon).mock.calls[0][1] as Blob;
        expect(JSON.parse(await blob.text())).toEqual([{ id: "1", name: "LCP", value: 200, page: "watch", device: "mobile", delivery: "page" }]);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("uses fetch when sendBeacon refuses and tolerates network failures", async () => {
        vi.mocked(navigator.sendBeacon).mockReturnValue(false);
        vi.mocked(fetch).mockRejectedValue(new Error("offline"));
        const client = await import("../client");
        client.reportPerformanceSample({ id: "1", name: "PLAYER_STARTUP", value: 700, delivery: "file" });
        client.flushPerformanceSamples();
        expect(fetch).toHaveBeenCalledWith("/api/performance", expect.objectContaining({ keepalive: true, credentials: "same-origin" }));
        await vi.advanceTimersByTimeAsync(15000);
        expect(fetch).toHaveBeenCalledOnce();
    });

    it("does no sending or scheduling for an excluded visit", async () => {
        vi.stubEnv("NEXT_PUBLIC_PERFORMANCE_SAMPLE_RATE", "0");
        const client = await import("../client");
        client.reportPerformanceSample({ id: "1", name: "LCP", value: 200 });
        expect(vi.getTimerCount()).toBe(0);
        client.flushPerformanceSamples();
        expect(navigator.sendBeacon).not.toHaveBeenCalled();
    });
});
