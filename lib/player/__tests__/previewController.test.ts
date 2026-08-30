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
    getAttribute: vi.fn(() => null),
    removeAttribute: vi.fn(),
    load: vi.fn(),
    currentSrc: "",
    preload: "",
    playsInline: false,
}) as unknown as HTMLVideoElement;

describe("previewController intent", () => {
    it("20 szybkich hoverów nie wysyła żadnego requestu przed progiem intencji", async () => {
        const { cancelPreview, schedulePreview } = await import("@/components/series/previewController");
        let lastToken = Symbol("initial");
        const elements: HTMLVideoElement[] = [];

        for (let index = 0; index < 20; index += 1) {
            lastToken = Symbol(`card-${index}`);
            const element = videoElement();
            elements.push(element);
            schedulePreview({
                token: lastToken,
                element,
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
        expect(elements.every((element) => !vi.mocked(element.load).mock.calls.length)).toBe(true);
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
