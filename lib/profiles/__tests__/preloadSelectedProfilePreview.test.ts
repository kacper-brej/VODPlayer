import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    preloadHeroPreview: vi.fn(),
    shouldPreloadHeroPreview: vi.fn(),
    fetch: vi.fn(),
}));

vi.mock("@/lib/player/preloadHeroPreview", () => ({
    preloadHeroPreview: mocks.preloadHeroPreview,
    shouldPreloadHeroPreview: mocks.shouldPreloadHeroPreview,
}));

import { preloadSelectedProfilePreview } from "@/lib/profiles/preloadSelectedProfilePreview";

const previewSource = { kind: "session", src: "/api/preview?s=series&e=01.mp4", startSeconds: 0 };

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.shouldPreloadHeroPreview.mockReturnValue(true);
    mocks.preloadHeroPreview.mockResolvedValue(undefined);
    mocks.fetch.mockResolvedValue(Response.json({ previewSource }));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("preloadSelectedProfilePreview", () => {
    it("warms the selected preview through a separate uncached request", async () => {
        await preloadSelectedProfilePreview(12);

        expect(mocks.fetch).toHaveBeenCalledWith("/api/profiles/preview?profileId=12", expect.objectContaining({
            credentials: "same-origin",
            cache: "no-store",
            signal: expect.any(AbortSignal),
        }));
        expect(mocks.preloadHeroPreview).toHaveBeenCalledWith(previewSource);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("does not start any request when device policy disables previews", async () => {
        mocks.shouldPreloadHeroPreview.mockReturnValue(false);

        await preloadSelectedProfilePreview(12);

        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.preloadHeroPreview).not.toHaveBeenCalled();
    });

    it("checks device policy again before downloading media", async () => {
        mocks.shouldPreloadHeroPreview.mockReturnValueOnce(true).mockReturnValue(false);

        await preloadSelectedProfilePreview(12);

        expect(mocks.fetch).toHaveBeenCalledOnce();
        expect(mocks.preloadHeroPreview).not.toHaveBeenCalled();
    });

    it("aborts slow preview lookups without leaving an active timer", async () => {
        mocks.fetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        }));
        const pending = preloadSelectedProfilePreview(12);

        await vi.advanceTimersByTimeAsync(4_000);
        await pending;

        expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
        expect(mocks.preloadHeroPreview).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
        { previewSource: null },
        { previewSource: { ...previewSource, src: "https://example.org/media" } },
        { previewSource: { ...previewSource, kind: "file" } },
        null,
    ])("ignores absent or invalid preview data %j", async (data) => {
        mocks.fetch.mockResolvedValue(Response.json(data));

        await preloadSelectedProfilePreview(12);

        expect(mocks.preloadHeroPreview).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("ignores unsuccessful lookups without affecting navigation", async () => {
        mocks.fetch.mockResolvedValue(new Response(null, { status: 409 }));

        await expect(preloadSelectedProfilePreview(12)).resolves.toBeUndefined();
        expect(mocks.preloadHeroPreview).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});
