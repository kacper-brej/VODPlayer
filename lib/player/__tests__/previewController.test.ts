import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { connection: { saveData: false }, userActivation: { hasBeenActive: true } });
    vi.stubGlobal("document", {
        visibilityState: "visible",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", {
        location: { origin: "http://localhost:3000" },
        addEventListener: vi.fn(),
        matchMedia: (query: string) => ({
            matches: query === "(hover: hover) and (pointer: fine)",
        }),
    });
});

describe("previewController activation", () => {
    it("installs four listeners once for 200 mounted cards", async () => {
        vi.stubGlobal("navigator", { userActivation: { hasBeenActive: false } });
        vi.stubGlobal("sessionStorage", { getItem: vi.fn(() => null), setItem: vi.fn() });
        const { trackUserActivation } = await import("@/components/series/previewController");

        for (let index = 0; index < 200; index += 1) trackUserActivation();

        expect(document.addEventListener).toHaveBeenCalledTimes(4);
        expect(vi.mocked(document.addEventListener).mock.calls.map(([event]) => event)).toEqual([
            "pointerdown", "mousedown", "touchstart", "keydown",
        ]);
    });

    it("remembers activation when session storage is unavailable", async () => {
        vi.stubGlobal("navigator", { userActivation: { hasBeenActive: false } });
        vi.stubGlobal("sessionStorage", {
            getItem: vi.fn(() => { throw new Error("unavailable"); }),
            setItem: vi.fn(() => { throw new Error("unavailable"); }),
        });
        const { trackUserActivation, isPreviewMuted } = await import("@/components/series/previewController");
        trackUserActivation();
        const activate = vi.mocked(document.addEventListener).mock.calls[0][1] as EventListener;
        activate(new Event("pointerdown"));
        trackUserActivation();

        expect(document.removeEventListener).toHaveBeenCalledTimes(4);
        expect(document.addEventListener).toHaveBeenCalledTimes(4);
        expect(isPreviewMuted()).toBe(false);
    });

    it.each(["session", "navigator"])("does not install listeners after %s activation", async (activation) => {
        vi.stubGlobal("navigator", { userActivation: { hasBeenActive: activation === "navigator" } });
        vi.stubGlobal("sessionStorage", {
            getItem: vi.fn((key: string) => activation === "session" && key === "nx-user-activated" ? "1" : null),
            setItem: vi.fn(),
        });
        const { trackUserActivation, isPreviewMuted } = await import("@/components/series/previewController");

        trackUserActivation();

        expect(document.addEventListener).not.toHaveBeenCalled();
        expect(isPreviewMuted()).toBe(false);
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
