"use client";

import { useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { flushSync } from "react-dom";
import { EPISODE_WINDOW_THRESHOLD, episodeColumns, estimateEpisodeRowHeight, getMountedEpisodeRows } from "@/lib/ui/episodeWindow";

export interface EpisodeWindowHandle {
    focusItem: (index: number) => void;
}

interface PlaceholderButton {
    label: string;
    tabIndex: number;
}

interface EpisodeWindowProps {
    count: number;
    label: string;
    className: string;
    layout: "grid" | "list";
    busy?: boolean;
    windowRef?: Ref<EpisodeWindowHandle>;
    placeholderButtons: (index: number) => PlaceholderButton[];
    renderItem: (index: number) => ReactNode;
}

const subscribeToWindowingSupport = () => () => {};
const readWindowingUnavailable = () => typeof IntersectionObserver === "undefined";
const readServerWindowingUnavailable = () => false;

const findScrollRoot = (element: HTMLElement) => {
    let current: HTMLElement | null = element;
    while (current) {
        if (/(auto|scroll)/.test(window.getComputedStyle(current).overflowY)) return current;
        current = current.parentElement;
    }
    return null;
};

const DeferredEpisodeWindow = ({ count, label, className, layout, busy, windowRef, placeholderButtons, renderItem }: EpisodeWindowProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const rowsRef = useRef(new Map<number, HTMLDivElement>());
    const [geometry, setGeometry] = useState({ width: 0, columns: 1, desktop: false });
    const [visibleRows, setVisibleRows] = useState<number[] | null>(null);
    const [focusedRow, setFocusedRow] = useState<number | null>(null);
    const [heights, setHeights] = useState<Record<number, number>>({});
    const windowingUnavailable = useSyncExternalStore(
        subscribeToWindowingSupport,
        readWindowingUnavailable,
        readServerWindowingUnavailable,
    );
    const gap = layout === "grid" ? 16 : 12;
    const rowCount = Math.ceil(count / geometry.columns);
    const mountedRows = getMountedEpisodeRows(rowCount, visibleRows, focusedRow);
    const mountedKey = Array.from(mountedRows).sort((left, right) => left - right).join(",");
    const estimatedHeight = layout === "list"
        ? geometry.desktop ? 130 : 106
        : estimateEpisodeRowHeight(geometry.width || 360, geometry.columns, gap);

    const focusItem = (index: number, buttonIndex = 0) => {
        if (index < 0 || index >= count) return;
        flushSync(() => setFocusedRow(Math.floor(index / geometry.columns)));
        const slot = rootRef.current?.querySelector<HTMLElement>(`[data-episode-slot="${index}"]`);
        const button = slot?.querySelectorAll<HTMLButtonElement>("button")[buttonIndex];
        button?.focus({ preventScroll: true });
        button?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    useImperativeHandle(windowRef, () => ({ focusItem }));

    useEffect(() => {
        const element = rootRef.current;
        if (!element) return;
        let frame = 0;
        const measure = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const width = Math.round(element.clientWidth);
                const columns = layout === "grid" ? episodeColumns(window.innerWidth) : 1;
                const desktop = window.innerWidth >= 768;
                setGeometry((previous) => previous.width === width && previous.columns === columns && previous.desktop === desktop
                    ? previous
                    : { width, columns, desktop });
            });
        };
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
        observer?.observe(element);
        window.addEventListener("resize", measure, { passive: true });
        measure();
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [layout]);

    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") return;
        const element = rootRef.current;
        if (!element) return;
        const visible = new Set<number>();
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const index = Number((entry.target as HTMLElement).dataset.episodeRow);
                if (entry.isIntersecting) visible.add(index);
                else visible.delete(index);
            }
            const next = Array.from(visible).sort((left, right) => left - right);
            setVisibleRows((previous) => previous?.length === next.length && previous.every((row, index) => row === next[index]) ? previous : next);
        }, { root: findScrollRoot(element), rootMargin: "400px 0px" });
        for (const row of rowsRef.current.values()) observer.observe(row);
        return () => observer.disconnect();
    }, [rowCount, geometry.columns]);

    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver((entries) => {
            setHeights((previous) => {
                let next = previous;
                for (const entry of entries) {
                    const index = Number((entry.target as HTMLElement).dataset.episodeRow);
                    const height = Math.ceil(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height);
                    if (height > 0 && previous[index] !== height) {
                        if (next === previous) next = { ...previous };
                        next[index] = height;
                    }
                }
                return next;
            });
        });
        for (const value of mountedKey.split(",")) {
            if (!value) continue;
            const row = rowsRef.current.get(Number(value));
            if (row) observer.observe(row);
        }
        return () => observer.disconnect();
    }, [mountedKey, geometry.width, geometry.columns]);

    return (
        <div
            ref={rootRef}
            role={layout === "grid" ? "grid" : undefined}
            aria-label={label}
            aria-busy={busy}
            aria-rowcount={layout === "grid" ? rowCount : undefined}
            aria-colcount={layout === "grid" ? geometry.columns : undefined}
            className={className}
            style={{ display: "flex", flexDirection: "column", gap }}
            onFocusCapture={(event) => {
                const row = (event.target as HTMLElement).closest<HTMLElement>("[data-episode-row]");
                if (row) setFocusedRow(Number(row.dataset.episodeRow));
            }}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocusedRow(null);
            }}
        >
            {Array.from({ length: rowCount }, (_, rowIndex) => {
                const mounted = windowingUnavailable || mountedRows.has(rowIndex);
                const start = rowIndex * geometry.columns;
                const length = Math.min(geometry.columns, count - start);
                return (
                    <div
                        key={`${geometry.columns}:${rowIndex}`}
                        ref={(element) => {
                            if (element) rowsRef.current.set(rowIndex, element);
                            else rowsRef.current.delete(rowIndex);
                        }}
                        data-episode-row={rowIndex}
                        data-episode-mounted={mounted ? "true" : "false"}
                        role={layout === "grid" ? "row" : undefined}
                        aria-rowindex={layout === "grid" ? rowIndex + 1 : undefined}
                        style={{ display: "grid", gridTemplateColumns: `repeat(${geometry.columns}, minmax(0, 1fr))`, gap, flexShrink: 0, height: mounted ? undefined : heights[rowIndex] ?? estimatedHeight }}
                    >
                        {Array.from({ length }, (_, offset) => {
                            const index = start + offset;
                            return (
                                <div key={index} data-episode-slot={index} style={{ display: "contents" }}>
                                    {mounted ? renderItem(index) : (
                                        <div role={layout === "grid" ? "gridcell" : undefined} className="relative h-full rounded-xl bg-nx-panel">
                                            {placeholderButtons(index).map((button, buttonIndex) => (
                                                <button
                                                    key={buttonIndex}
                                                    type="button"
                                                    tabIndex={button.tabIndex}
                                                    aria-label={button.label}
                                                    className="absolute inset-0 size-full"
                                                    onFocus={() => focusItem(index, buttonIndex)}
                                                >
                                                    <span className="sr-only">{button.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

const StaticEpisodeWindow = ({ count, label, className, layout, busy, windowRef, renderItem }: EpisodeWindowProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(windowRef, () => ({
        focusItem: (index) => rootRef.current?.querySelector<HTMLButtonElement>(`[data-episode-slot="${index}"] button`)?.focus(),
    }));
    return (
        <div ref={rootRef} role={layout === "grid" ? "grid" : undefined} aria-label={label} aria-busy={busy} className={className}>
            {Array.from({ length: count }, (_, index) => (
                <div key={index} data-episode-slot={index} style={{ display: "contents" }}>{renderItem(index)}</div>
            ))}
        </div>
    );
};

const EpisodeWindow = (props: EpisodeWindowProps) => props.count > EPISODE_WINDOW_THRESHOLD
    ? <DeferredEpisodeWindow key={`${props.layout}:${props.count}`} {...props} />
    : <StaticEpisodeWindow {...props} />;

export default EpisodeWindow;
