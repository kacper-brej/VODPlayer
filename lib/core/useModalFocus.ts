"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

export const useModalFocus = <T extends HTMLElement>(
    open: boolean,
    onClose: () => void,
) => {
    const dialogRef = useRef<T>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const closeRef = useRef(onClose);

    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const root = document.documentElement;
        const previousOverflow = root.style.overflow;
        const previousPaddingRight = root.style.paddingRight;
        const widthBeforeLock = root.clientWidth;
        root.style.overflow = "hidden";
        const scrollbarGap = root.clientWidth - widthBeforeLock;
        if (scrollbarGap > 0) root.style.paddingRight = `${scrollbarGap}px`;

        const focusDialog = window.setTimeout(() => {
            const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
            (first ?? dialogRef.current)?.focus();
        }, 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeRef.current();
                return;
            }

            if (event.key !== "Tab" || !dialogRef.current) return;

            const focusable = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            ).filter((element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0);

            if (focusable.length === 0) {
                event.preventDefault();
                dialogRef.current.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            window.clearTimeout(focusDialog);
            document.removeEventListener("keydown", handleKeyDown);
            root.style.overflow = previousOverflow;
            root.style.paddingRight = previousPaddingRight;
            previousFocusRef.current?.focus();
        };
    }, [open]);

    return dialogRef;
};
