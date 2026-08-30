import type Hls from "hls.js";
import type { ErrorData as HlsErrorData } from "hls.js";
import { shouldAllowAutomaticPreview } from "@/lib/player/previewClientPolicy";
import { isPreviewSessionSource, type PreviewSessionSource } from "@/lib/player/previewTypes";

export type PreviewSourceKind = "session";
export type PreviewIntent = "hover" | "focus" | "manual";

export interface PreviewRequest {
    token: symbol;
    element: HTMLVideoElement;
    kind: PreviewSourceKind;
    src: string;
    startSeconds: number;
}

export interface PreviewOptions {
    intent: PreviewIntent;
    autoPreviewsEnabled: boolean;
    reduceData: boolean;
    delayMs?: number;
}

const PREVIEW_MAX_SECONDS = 10;
let activeToken: symbol | null = null;
let activeElement: HTMLVideoElement | null = null;
let activeAbortController: AbortController | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let mediaCleanup: (() => void) | null = null;
let hlsInstance: Hls | null = null;
let hlsConstructorPromise: Promise<typeof Hls> | null = null;
let previewMutedPreference: boolean | null = null;
let lifecycleListenersInstalled = false;

const PREVIEW_MUTED_KEY = "nx-preview-muted";
const USER_ACTIVATED_KEY = "nx-user-activated";

const readSession = (key: string): string | null => {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
};

const writeSession = (key: string, value: string): void => {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        // pamięć sesji bywa niedostępna w trybie prywatnym
    }
};

const ACTIVATION_EVENTS = ["pointerdown", "mousedown", "touchstart", "keydown"] as const;

export const trackUserActivation = (): void => {
    if (typeof document === "undefined" || readSession(USER_ACTIVATED_KEY) === "1") return;

    if (navigator.userActivation?.hasBeenActive) {
        writeSession(USER_ACTIVATED_KEY, "1");
        return;
    }

    const mark = () => {
        writeSession(USER_ACTIVATED_KEY, "1");
        for (const type of ACTIVATION_EVENTS) document.removeEventListener(type, mark, true);
    };

    for (const type of ACTIVATION_EVENTS) document.addEventListener(type, mark, true);
};

export const isPreviewMuted = (): boolean => {
    if (previewMutedPreference !== null) return previewMutedPreference;

    const stored = readSession(PREVIEW_MUTED_KEY);
    if (stored !== null) return stored === "1";

    if (typeof navigator === "undefined") return true;
    return !(navigator.userActivation?.hasBeenActive || readSession(USER_ACTIVATED_KEY) === "1");
};

export const setPreviewMuted = (muted: boolean): void => {
    previewMutedPreference = muted;
    writeSession(PREVIEW_MUTED_KEY, muted ? "1" : "0");
    if (activeElement) activeElement.muted = muted;
};

const loadHlsConstructor = (): Promise<typeof Hls> => {
    if (!hlsConstructorPromise) hlsConstructorPromise = import("hls.js").then((module) => module.default);
    return hlsConstructorPromise;
};

const playWithAutoplayFallback = (element: HTMLVideoElement): void => {
    void element.play().catch(() => {
        if (element.muted) return;
        element.muted = true;
        void element.play().catch(() => {});
    });
};

const detachHls = (): void => {
    hlsInstance?.destroy();
    hlsInstance = null;
};

const clearPending = (): void => {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
};

const stopActiveElement = (): void => {
    clearPending();
    activeAbortController?.abort();
    activeAbortController = null;
    mediaCleanup?.();
    mediaCleanup = null;
    const element = activeElement;
    const hadAttachedMedia = Boolean(
        hlsInstance
        || element?.currentSrc
        || element?.getAttribute("src"),
    );
    detachHls();
    if (element && hadAttachedMedia) {
        element.pause();
        element.removeAttribute("src");
        element.load();
    }
    activeElement = null;
};

const cancelActivePreview = (): void => {
    activeToken = null;
    stopActiveElement();
};

const ensureLifecycleListeners = (): void => {
    if (lifecycleListenersInstalled || typeof window === "undefined") return;
    lifecycleListenersInstalled = true;
    window.addEventListener("pagehide", cancelActivePreview);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") cancelActivePreview();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") cancelActivePreview();
    });
};

export const cancelPreview = (token: symbol): void => {
    if (activeToken !== token) return;
    cancelActivePreview();
};

const claimPreviewSlot = (token: symbol, element: HTMLVideoElement): void => {
    stopActiveElement();
    activeToken = token;
    activeElement = element;
    ensureLifecycleListeners();
};

const connectionSaveData = (): boolean =>
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

const shouldStart = (options: PreviewOptions): boolean => {
    if (typeof window === "undefined" || document.visibilityState !== "visible") return false;
    if (options.intent === "manual") return true;
    return shouldAllowAutomaticPreview({
        autoPreviewsEnabled: options.autoPreviewsEnabled,
        reduceData: options.reduceData,
        saveData: connectionSaveData(),
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        documentVisible: true,
        finePointer: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
        intent: options.intent,
    });
};

const bindPreviewLimit = (token: symbol, element: HTMLVideoElement, startSeconds: number): void => {
    mediaCleanup?.();
    const stopAtLimit = () => {
        if (activeToken === token && element.currentTime >= startSeconds + PREVIEW_MAX_SECONDS) {
            cancelActivePreview();
        }
    };
    const stopAtEnd = () => {
        if (activeToken === token) cancelActivePreview();
    };
    element.addEventListener("timeupdate", stopAtLimit);
    element.addEventListener("ended", stopAtEnd);
    mediaCleanup = () => {
        element.removeEventListener("timeupdate", stopAtLimit);
        element.removeEventListener("ended", stopAtEnd);
    };
};

const bindPendingMediaEvents = (
    element: HTMLVideoElement,
    events: Array<["loadedmetadata" | "loadeddata", EventListener]>,
): void => {
    mediaCleanup?.();
    for (const [name, listener] of events) element.addEventListener(name, listener, { once: true });
    mediaCleanup = () => {
        for (const [name, listener] of events) element.removeEventListener(name, listener);
    };
};

const startMp4Preview = (token: symbol, element: HTMLVideoElement, source: PreviewSessionSource): void => {
    const applyStartPosition = () => {
        if (activeToken !== token) return;
        element.currentTime = source.mediaOffsetSeconds;
        bindPreviewLimit(token, element, source.mediaOffsetSeconds);
        playWithAutoplayFallback(element);
    };
    element.muted = isPreviewMuted();
    bindPendingMediaEvents(element, [["loadedmetadata", applyStartPosition]]);
    element.src = source.src;
    element.load();
};

const fetchPreviewSession = async (url: string, signal: AbortSignal): Promise<PreviewSessionSource> => {
    const response = await fetch(new URL(url, window.location.origin), {
        credentials: "same-origin",
        cache: "no-store",
        signal,
    });
    if (!response.ok) throw new Error(`preview-session-${response.status}`);
    const value: unknown = await response.json();
    if (!isPreviewSessionSource(value)) throw new Error("preview-session-invalid");
    return value;
};

const startHlsPreview = async (
    request: PreviewRequest,
    source: PreviewSessionSource,
    options: PreviewOptions,
    refreshAttempt: number,
): Promise<void> => {
    const { element, token } = request;
    element.muted = isPreviewMuted();
    const HlsConstructor = await loadHlsConstructor();
    if (activeToken !== token) return;
    detachHls();
    hlsInstance = new HlsConstructor({
        startLevel: 0,
        capLevelToPlayerSize: true,
        maxBufferLength: 12,
        autoStartLoad: false,
        abrEwmaDefaultEstimate: 200_000,
    });
    const instance = hlsInstance;
    instance.attachMedia(element);
    instance.loadSource(source.src);
    instance.on(HlsConstructor.Events.ERROR, (_event, detail: HlsErrorData) => {
        const status = detail.response?.code;
        if (!detail.fatal || (status !== 403 && status !== 410) || refreshAttempt >= 1 || activeToken !== token) return;
        void resolveAndStart(request, options, refreshAttempt + 1);
    });
    const applyStartPosition = () => {
        if (activeToken !== token) return;
        if (Math.abs(element.currentTime - source.mediaOffsetSeconds) > 0.25) element.currentTime = source.mediaOffsetSeconds;
    };
    const handleLoadedData = () => {
        if (activeToken !== token) return;
        applyStartPosition();
        bindPreviewLimit(token, element, source.mediaOffsetSeconds);
        playWithAutoplayFallback(element);
    };
    bindPendingMediaEvents(element, [
        ["loadedmetadata", applyStartPosition],
        ["loadeddata", handleLoadedData],
    ]);
    instance.startLoad(source.mediaOffsetSeconds);
};

async function resolveAndStart(
    request: PreviewRequest,
    options: PreviewOptions,
    refreshAttempt: number,
): Promise<number | null> {
    activeAbortController?.abort();
    const controller = new AbortController();
    activeAbortController = controller;
    try {
        const source = await fetchPreviewSession(request.src, controller.signal);
        if (activeToken !== request.token) return null;
        if (source.type === "mp4") startMp4Preview(request.token, request.element, source);
        else await startHlsPreview(request, source, options, refreshAttempt);
        return source.mediaOffsetSeconds;
    } catch {
        if (activeToken === request.token) cancelActivePreview();
        return null;
    }
}

export const requestPreview = async (request: PreviewRequest, options: PreviewOptions): Promise<number | null> => {
    if (!shouldStart(options)) return null;
    claimPreviewSlot(request.token, request.element);
    request.element.preload = "none";
    request.element.playsInline = true;
    return resolveAndStart(request, options, 0);
};

export const schedulePreview = (request: PreviewRequest, options: PreviewOptions): void => {
    if (!shouldStart(options)) return;
    claimPreviewSlot(request.token, request.element);
    pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (activeToken !== request.token) return;
        void resolveAndStart(request, options, 0);
    }, Math.max(0, options.delayMs ?? 300));
};
