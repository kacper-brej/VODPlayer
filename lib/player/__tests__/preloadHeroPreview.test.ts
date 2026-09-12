import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadHeroPreview } from "@/lib/player/preloadHeroPreview";
import type { PreviewSource } from "@/lib/player/videoAccess";
import type { PreviewSessionSource } from "@/lib/player/previewTypes";

const source: PreviewSource = { kind: "session", src: "/api/preview?s=series&e=01.mp4", startSeconds: 0 };
const session = (type: "mp4" | "hls"): PreviewSessionSource => ({
    mode: "preview",
    type,
    src: `/api/preview/${type}/token`,
    expiresAt: 1_800_000_000,
    sourceTimelineStartSeconds: 0,
    mediaOffsetSeconds: 6,
    durationSeconds: 10,
    reason: "default",
});
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { connection: { saveData: false } });
    vi.stubGlobal("document", { visibilityState: "visible" });
    vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: false })) });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("preloadHeroPreview", () => {
    it("warms only the MP4 opening range and clears its deadline", async () => {
        fetchMock.mockResolvedValueOnce(Response.json(session("mp4")));
        fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));

        await preloadHeroPreview(source);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ headers: { Range: "bytes=0-262143" } });
        expect(fetchMock.mock.calls[1][1]?.signal).toBe(fetchMock.mock.calls[0][1]?.signal);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("aborts an unfinished session request after four seconds", async () => {
        fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }));

        const preloading = preloadHeroPreview(source);
        const signal = fetchMock.mock.calls[0][1]?.signal;
        await vi.advanceTimersByTimeAsync(3_999);
        expect(signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await preloading;

        expect(signal?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("shares the abort deadline with the manifest, init and selected HLS segment", async () => {
        fetchMock.mockResolvedValueOnce(Response.json(session("hls")));
        fetchMock.mockResolvedValueOnce(new Response([
            "#EXTM3U",
            '#EXT-X-MAP:URI="/api/preview/init"',
            "#EXTINF:6,",
            "/api/preview/segment-0",
            "#EXTINF:6,",
            "/api/preview/segment-1",
        ].join("\n")));
        fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }));

        const preloading = preloadHeroPreview(source);
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            source.src, "/api/preview/hls/token", "/api/preview/init", "/api/preview/segment-1",
        ]);
        const signals = fetchMock.mock.calls.map(([, init]) => init?.signal);
        expect(new Set(signals).size).toBe(1);
        await vi.advanceTimersByTimeAsync(4_000);
        await preloading;

        expect(signals.every((signal) => signal?.aborted)).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["save-data", "reduced-motion", "hidden"])("does not transfer data for %s", async (policy) => {
        if (policy === "save-data") vi.stubGlobal("navigator", { connection: { saveData: true } });
        if (policy === "reduced-motion") vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
        if (policy === "hidden") vi.stubGlobal("document", { visibilityState: "hidden" });

        await preloadHeroPreview(source);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("clears its timeout when the session fails", async () => {
        fetchMock.mockRejectedValueOnce(new Error("network"));

        await preloadHeroPreview(source);

        expect(vi.getTimerCount()).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
