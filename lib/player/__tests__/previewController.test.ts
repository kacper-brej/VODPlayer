import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { connection: { saveData: false }, userActivation: { hasBeenActive: true } });
    vi.stubGlobal("document", {
        visibilityState: "visible",
        addEventListener: vi.fn(),
    });
    vi.stubGlobal("window", {
        location: { origin: "http://localhost:3000" },
        addEventListener: vi.fn(),
        matchMedia: (query: string) => ({
            matches: query === "(hover: hover) and (pointer: fine)",
        }),
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const videoElement = () => ({
    pause: vi.fn(),
    removeAttribute: vi.fn(),
    load: vi.fn(),
    preload: "",
    playsInline: false,
}) as unknown as HTMLVideoElement;

describe("previewController intent", () => {
    it("20 szybkich hoverów nie wysyła żadnego requestu przed progiem intencji", async () => {
        const { cancelPreview, schedulePreview } = await import("@/components/series/previewController");
        let lastToken = Symbol("initial");

        for (let index = 0; index < 20; index += 1) {
            lastToken = Symbol(`card-${index}`);
            schedulePreview({
                token: lastToken,
                element: videoElement(),
                kind: "session",
                src: `/api/preview?s=series-${index}&e=01.mp4`,
                startSeconds: 0,
            }, {
                intent: "hover",
                autoPreviewsEnabled: true,
                reduceData: false,
                delayMs: 300,
            });
        }

        cancelPreview(lastToken);
        await vi.advanceTimersByTimeAsync(500);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("po zatrzymaniu na ostatniej karcie wysyła tylko jeden request", async () => {
        const { schedulePreview } = await import("@/components/series/previewController");

        for (let index = 0; index < 20; index += 1) {
            schedulePreview({
                token: Symbol(`stable-card-${index}`),
                element: videoElement(),
                kind: "session",
                src: `/api/preview?s=series-${index}&e=01.mp4`,
                startSeconds: 0,
            }, {
                intent: "hover",
                autoPreviewsEnabled: true,
                reduceData: false,
                delayMs: 300,
            });
        }

        await vi.advanceTimersByTimeAsync(300);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
