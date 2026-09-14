import type { FocusEvent, PointerEvent } from "react";

let pending: Promise<unknown> | null = null;

export const preloadPlayerOnIntent = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData || document.visibilityState === "hidden") return;
    pending ??= import("@/components/video/VideoPlayer").catch(() => {
        pending = null;
    });
    return pending;
};

export const playerLinkIntentProps = {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse") void preloadPlayerOnIntent();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.target === event.currentTarget && event.currentTarget.matches(":focus-visible")) {
            void preloadPlayerOnIntent();
        }
    },
};

export const playerButtonIntentProps = {
    ...playerLinkIntentProps,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.isPrimary && event.button === 0) void preloadPlayerOnIntent();
    },
};
