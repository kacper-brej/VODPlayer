import type Hls from "hls.js";

export type PreviewSourceKind = "hls" | "mp4";

export interface PreviewRequest {
    token: symbol;
    element: HTMLVideoElement;
    kind: PreviewSourceKind;
    src: string;
    startSeconds: number;
}

let activeToken: symbol | null = null;
let activeElement: HTMLVideoElement | null = null;
let hlsInstance: Hls | null = null;
let hlsConstructorPromise: Promise<typeof Hls> | null = null;

const loadHlsConstructor = (): Promise<typeof Hls> => {
    if (!hlsConstructorPromise) {
        hlsConstructorPromise = import("hls.js").then((module) => module.default);
    }

    return hlsConstructorPromise;
};

const detachHls = (): void => {
    if (!hlsInstance) return;

    hlsInstance.stopLoad();
    hlsInstance.detachMedia();
};

const stopActiveElement = (): void => {
    detachHls();

    if (activeElement) {
        activeElement.pause();
        activeElement.removeAttribute("src");
        activeElement.load();
    }

    activeElement = null;
};

export const cancelPreview = (token: symbol): void => {
    if (activeToken !== token) return;

    activeToken = null;
    stopActiveElement();
};

export const claimPreviewSlot = (token: symbol, element: HTMLVideoElement): void => {
    if (activeToken === token) return;

    stopActiveElement();
    activeToken = token;
    activeElement = element;
};

const shouldSkipPreview = (): boolean => {
    if (typeof window === "undefined") return true;
    if (document.visibilityState !== "visible") return true;
    if (window.matchMedia("(hover: none)").matches) return true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

    return Boolean(connection?.saveData);
};

const startMp4Preview = (request: PreviewRequest): void => {
    const { element, src, startSeconds, token } = request;

    const applyStartPosition = () => {
        if (activeToken !== token) return;

        element.currentTime = startSeconds;
        void element.play().catch(() => {});
    };

    element.muted = true;
    element.addEventListener("loadedmetadata", applyStartPosition, { once: true });
    element.src = src;
    element.load();
};

const startHlsPreview = (request: PreviewRequest): void => {
    const { element, src, startSeconds, token } = request;

    element.muted = true;

    void loadHlsConstructor().then((HlsConstructor) => {
        if (activeToken !== token) return;

        if (!hlsInstance) {
            hlsInstance = new HlsConstructor({
                startLevel: 0,
                capLevelToPlayerSize: true,
                maxBufferLength: 8,
                autoStartLoad: false,
                abrEwmaDefaultEstimate: 200_000,
            });
        }

        hlsInstance.detachMedia();
        hlsInstance.attachMedia(element);
        hlsInstance.loadSource(src);
        hlsInstance.startLoad(startSeconds);

        element.addEventListener("loadeddata", () => {
            if (activeToken !== token) return;

            void element.play().catch(() => {});
        }, { once: true });
    });
};

export const requestPreview = (request: PreviewRequest): void => {
    if (shouldSkipPreview()) return;

    stopActiveElement();
    activeToken = request.token;
    activeElement = request.element;

    request.element.preload = "none";
    request.element.playsInline = true;

    if (request.kind === "mp4") {
        startMp4Preview(request);
    } else {
        startHlsPreview(request);
    }
};
