"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { flushSync } from "react-dom";
import { EPISODE_WINDOW_THRESHOLD, episodeColumns, estimateEpisodeRowHeight, findVisibleEpisodeRow, getMountedEpisodeRows } from "@/lib/ui/episodeWindow";

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

interface EpisodeViewport {
    anchor: { index: number; top: number; scrollRoot: HTMLElement | null } | null;
    focus: { index: number; buttonIndex: number; visible: boolean } | null;
}

const findScrollRoot = (element: HTMLElement) => {
    let current: HTMLElement | null = element;
    while (current) {
        if (/(auto|scroll)/.test(window.getComputedStyle(current).overflowY) && current.scrollHeight > current.clientHeight) return current;
        current = current.parentElement;
    }
    return null;
};

const readEpisodeViewport = (element: HTMLElement, rows: Map<number, HTMLDivElement>, columns: number): EpisodeViewport => {
    const activeElement = document.activeElement;
    const focusedSlot = activeElement instanceof HTMLElement && element.contains(activeElement)
        ? activeElement.closest<HTMLElement>("[data-episode-slot]")
        : null;
    const scrollRoot = findScrollRoot(element);
    const viewportTop = scrollRoot ? scrollRoot.getBoundingClientRect().top + scrollRoot.clientTop : 0;
    const viewportBottom = viewportTop + (scrollRoot?.clientHeight ?? window.innerHeight);
    const focusedRect = focusedSlot && activeElement instanceof HTMLElement ? activeElement.getBoundingClientRect() : null;
    const focus = focusedSlot ? {
        index: Number(focusedSlot.dataset.episodeSlot),
        buttonIndex: Array.from(focusedSlot.querySelectorAll("button")).findIndex((button) => button === activeElement),
        visible: Boolean(focusedRect && focusedRect.bottom > viewportTop && focusedRect.top < viewportBottom),
    } : null;
    let anchorRow = focus?.visible ? focusedSlot?.closest<HTMLElement>("[data-episode-row]") : null;
    if (!anchorRow) {
        const index = findVisibleEpisodeRow(rows.size, (row) => rows.get(row)?.getBoundingClientRect(), viewportTop, viewportBottom);
        if (index !== null) anchorRow = rows.get(index);
    }
    const anchor = anchorRow ? {
        index: focus?.visible ? focus.index : Number(anchorRow.dataset.episodeRow) * columns,
        top: anchorRow.getBoundingClientRect().top,
        scrollRoot,
    } : null;
    return { anchor, focus };
};

const DeferredEpisodeWindow = ({ count, label, className, layout, busy, windowRef, placeholderButtons, renderItem }: EpisodeWindowProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const rowsRef = useRef(new Map<number, HTMLDivElement>());
    const pendingResize = useRef<EpisodeViewport | null>(null);
    const stableViewport = useRef<EpisodeViewport | null>(null);
    const [geometry, setGeometry] = useState({ width: 0, columns: 1, desktop: false });
    const [visibleRows, setVisibleRows] = useState<number[] | null>(null);
    const [focusedItem, setFocusedItem] = useState<number | null>(null);
    const [heights, setHeights] = useState<{ key: string; rows: Record<number, number> }>({ key: "", rows: {} });
    const windowingUnavailable = useSyncExternalStore(
        subscribeToWindowingSupport,
        readWindowingUnavailable,
        readServerWindowingUnavailable,
    );
    const gap = layout === "grid" ? 16 : 12;
    const geometryKey = `${geometry.width}:${geometry.columns}:${geometry.desktop}`;
    const rowCount = Math.ceil(count / geometry.columns);
    const mountedRows = getMountedEpisodeRows(rowCount, visibleRows, focusedItem === null ? null : Math.floor(focusedItem / geometry.columns));
    const mountedKey = Array.from(mountedRows).sort((left, right) => left - right).join(",");
    const estimatedHeight = layout === "list"
        ? geometry.desktop ? 130 : 106
        : estimateEpisodeRowHeight(geometry.width || 360, geometry.columns, gap);

    const focusItem = (index: number, buttonIndex = 0) => {
        if (index < 0 || index >= count) return;
        flushSync(() => setFocusedItem(index));
        const slot = rootRef.current?.querySelector<HTMLElement>(`[data-episode-slot="${index}"]`);
        const button = slot?.querySelectorAll<HTMLButtonElement>("button")[buttonIndex];
        button?.focus({ preventScroll: true });
        button?.scrollIntoView({ block: "nearest", inline: "nearest" });
        if (rootRef.current) stableViewport.current = readEpisodeViewport(rootRef.current, rowsRef.current, geometry.columns);
    };

    useImperativeHandle(windowRef, () => ({ focusItem }));

    useEffect(() => {
        const element = rootRef.current;
        if (!element) return;
        let frame = 0;
        let measured = { width: 0, columns: 1, desktop: false };
        const measure = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const width = Math.round(element.clientWidth);
                const columns = layout === "grid" ? episodeColumns(window.innerWidth) : 1;
                const desktop = window.innerWidth >= 768;
                if (measured.width === width && measured.columns === columns && measured.desktop === desktop) return;
                const previousColumns = measured.columns;
                const { anchor, focus: previousFocus } = stableViewport.current ?? { anchor: null, focus: null };
                const activeElement = document.activeElement;
                const activeSlot = activeElement instanceof HTMLElement && element.contains(activeElement)
                    ? activeElement.closest<HTMLElement>("[data-episode-slot]")
                    : null;
                const focus = activeSlot && Number(activeSlot.dataset.episodeSlot) === previousFocus?.index ? {
                    ...previousFocus,
                    buttonIndex: Array.from(activeSlot.querySelectorAll("button")).findIndex((button) => button === activeElement),
                } : null;
                pendingResize.current = { anchor, focus };
                measured = { width, columns, desktop };
                setVisibleRows((previous) => {
                    if (previous === null && !anchor) return null;
                    const rows = new Set<number>();
                    for (const row of previous ?? []) {
                        const first = Math.floor(row * previousColumns / columns);
                        const last = Math.floor(((row + 1) * previousColumns - 1) / columns);
                        for (let next = first; next <= last; next += 1) rows.add(next);
                    }
                    if (anchor) rows.add(Math.floor(anchor.index / columns));
                    return Array.from(rows).sort((left, right) => left - right);
                });
                if (focus) setFocusedItem(focus.index);
                setGeometry(measured);
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

    useLayoutEffect(() => {
        const pending = pendingResize.current;
        if (!pending) return;
        const { anchor, focus } = pending;
        let focusedButton: HTMLButtonElement | undefined;
        if (focus && focus.buttonIndex >= 0) {
            focusedButton = rootRef.current?.querySelector<HTMLElement>(`[data-episode-slot="${focus.index}"]`)
                ?.querySelectorAll<HTMLButtonElement>("button")[focus.buttonIndex];
            focusedButton?.focus({ preventScroll: true });
        }
        if (anchor) {
            const row = rowsRef.current.get(Math.floor(anchor.index / geometry.columns));
            if (row) {
                const delta = row.getBoundingClientRect().top - anchor.top;
                if (anchor.scrollRoot) anchor.scrollRoot.scrollTop += delta;
                else window.scrollBy(0, delta);
            }
        }
        if (focus?.visible && focusedButton) {
            const rect = focusedButton.getBoundingClientRect();
            const scrollRoot = anchor?.scrollRoot;
            const top = scrollRoot ? scrollRoot.getBoundingClientRect().top + scrollRoot.clientTop : 0;
            const bottom = top + (scrollRoot?.clientHeight ?? window.innerHeight);
            if (rect.top < top || rect.bottom > bottom) focusedButton.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        pendingResize.current = null;
    }, [geometry]);

    useLayoutEffect(() => {
        const element = rootRef.current;
        const columns = layout === "grid" ? episodeColumns(window.innerWidth) : 1;
        if (element && Math.round(element.clientWidth) === geometry.width && columns === geometry.columns && (window.innerWidth >= 768) === geometry.desktop) {
            stableViewport.current = readEpisodeViewport(element, rowsRef.current, geometry.columns);
        }
    });

    useEffect(() => {
        const element = rootRef.current;
        if (!element) return;
        let frame = 0;
        const capture = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (Math.round(element.clientWidth) !== geometry.width) return;
                const columns = layout === "grid" ? episodeColumns(window.innerWidth) : 1;
                if (columns !== geometry.columns || (window.innerWidth >= 768) !== geometry.desktop) return;
                stableViewport.current = readEpisodeViewport(element, rowsRef.current, geometry.columns);
            });
        };
        window.addEventListener("scroll", capture, { passive: true, capture: true });
        element.addEventListener("focusin", capture);
        element.addEventListener("focusout", capture);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", capture, true);
            element.removeEventListener("focusin", capture);
            element.removeEventListener("focusout", capture);
        };
    }, [geometry, layout]);

    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") return;
        const element = rootRef.current;
        if (!element) return;
        const visible = new Set<number>();
        let active = true;
        const observer = new IntersectionObserver((entries) => {
            if (!active) return;
            for (const entry of entries) {
                const index = Number((entry.target as HTMLElement).dataset.episodeRow);
                if (entry.isIntersecting) visible.add(index);
                else visible.delete(index);
            }
            const next = Array.from(visible).sort((left, right) => left - right);
            setVisibleRows((previous) => previous?.length === next.length && previous.every((row, index) => row === next[index]) ? previous : next);
        }, { root: findScrollRoot(element), rootMargin: "400px 0px" });
        for (const row of rowsRef.current.values()) observer.observe(row);
        return () => {
            active = false;
            observer.disconnect();
        };
    }, [rowCount, geometry.columns]);

    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return;
        let active = true;
        const observer = new ResizeObserver((entries) => {
            if (!active) return;
            setHeights((previous) => {
                const rows = previous.key === geometryKey ? previous.rows : {};
                let next = rows;
                for (const entry of entries) {
                    const index = Number((entry.target as HTMLElement).dataset.episodeRow);
                    const height = Math.ceil(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height);
                    if (height > 0 && rows[index] !== height) {
                        if (next === rows) next = { ...rows };
                        next[index] = height;
                    }
                }
                return previous.key === geometryKey && next === rows ? previous : { key: geometryKey, rows: next };
            });
        });
        for (const value of mountedKey.split(",")) {
            if (!value) continue;
            const row = rowsRef.current.get(Number(value));
            if (row) observer.observe(row);
        }
        return () => {
            active = false;
            observer.disconnect();
        };
    }, [mountedKey, geometryKey]);

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
                const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-episode-slot]");
                if (slot) setFocusedItem(Number(slot.dataset.episodeSlot));
            }}
            onBlurCapture={(event) => {
                if (!pendingResize.current && !event.currentTarget.contains(event.relatedTarget)) setFocusedItem(null);
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
                        style={{ display: "grid", gridTemplateColumns: `repeat(${geometry.columns}, minmax(0, 1fr))`, gap, flexShrink: 0, height: mounted ? undefined : heights.key === geometryKey ? heights.rows[rowIndex] ?? estimatedHeight : estimatedHeight }}
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
