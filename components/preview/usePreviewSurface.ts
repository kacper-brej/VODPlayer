"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import type { PreviewSource } from "@/lib/player/videoAccess";
import { usePreviewPreferences } from "@/components/preview/PreviewPreferences";
import {
    cancelPreview,
    requestPreview,
    schedulePreview,
    trackUserActivation,
} from "@/components/series/previewController";

export const PREVIEW_INTENT_MS = 300;

export const usePreviewSurface = (source: PreviewSource | null | undefined) => {
    const pathname = usePathname();
    const { autoPreviewsEnabled, reduceData } = usePreviewPreferences();
    const tokenRef = useRef(Symbol("preview-surface"));
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const stop = useCallback(() => {
        cancelPreview(tokenRef.current);
        setIsPlaying(false);
    }, []);

    const makeRequest = useCallback(() => {
        const element = videoRef.current;
        if (!source || !element) return null;
        return {
            token: tokenRef.current,
            element,
            kind: source.kind,
            src: source.src,
            startSeconds: source.startSeconds,
        } as const;
    }, [source]);

    const startAutomatic = useCallback((intent: "hover" | "focus") => {
        const request = makeRequest();
        if (!request) return;
        schedulePreview(request, {
            intent,
            delayMs: PREVIEW_INTENT_MS,
            autoPreviewsEnabled,
            reduceData,
        });
    }, [autoPreviewsEnabled, makeRequest, reduceData]);

    const startManual = useCallback((event?: MouseEvent<HTMLElement>) => {
        event?.preventDefault();
        event?.stopPropagation();
        const request = makeRequest();
        if (!request) return;
        void requestPreview(request, { intent: "manual", autoPreviewsEnabled, reduceData });
    }, [autoPreviewsEnabled, makeRequest, reduceData]);

    useEffect(trackUserActivation, []);

    useEffect(() => stop, [stop, pathname, source?.src]);

    return {
        videoRef,
        isPlaying,
        startManual,
        stop,
        surfaceProps: {
            onMouseEnter: () => startAutomatic("hover"),
            onMouseLeave: stop,
            onFocus: (event: FocusEvent<HTMLElement>) => {
                if (event.target === event.currentTarget && event.currentTarget.matches(":focus-visible")) {
                    startAutomatic("focus");
                }
            },
            onBlur: (event: FocusEvent<HTMLElement>) => {
                if (!event.currentTarget.contains(event.relatedTarget)) stop();
            },
        },
        videoProps: {
            ref: videoRef,
            muted: true,
            playsInline: true,
            preload: "none" as const,
            onPlaying: () => setIsPlaying(true),
            onPause: () => setIsPlaying(false),
            onEnded: stop,
            onError: stop,
        },
    };
};
