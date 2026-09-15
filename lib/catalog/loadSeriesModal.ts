import type { FocusEvent, PointerEvent } from "react";

export type SeriesModalModule = typeof import("@/components/series/SeriesModal");

let pending: Promise<SeriesModalModule> | null = null;

export const loadSeriesModal = (): Promise<SeriesModalModule> => {
    pending ??= import("@/components/series/SeriesModal").catch((error: unknown) => {
        pending = null;
        throw error;
    });
    return pending;
};

export const preloadSeriesModal = (): void => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData || document.visibilityState === "hidden") return;
    void loadSeriesModal().catch(() => {});
};

export const seriesInfoIntentProps = {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse") preloadSeriesModal();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.target === event.currentTarget && event.currentTarget.matches(":focus-visible")) preloadSeriesModal();
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.isPrimary && event.button === 0) preloadSeriesModal();
    },
};
