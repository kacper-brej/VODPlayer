export interface ContentRowWindow {
    start: number;
    end: number;
}

export const CONTENT_ROW_WINDOW_THRESHOLD = 24;

export const getContentRowWindow = (
    count: number,
    scrollLeft: number,
    viewportWidth: number,
    cardStep: number,
    startOffset = 0,
): ContentRowWindow => {
    if (count <= CONTENT_ROW_WINDOW_THRESHOLD) return { start: 0, end: count };
    if (cardStep <= 0 || viewportWidth <= 0) return { start: 0, end: Math.min(count, 12) };

    const offset = Math.max(0, scrollLeft - startOffset);
    const first = Math.min(count - 1, Math.floor(offset / cardStep));
    const visibleCount = Math.max(1, Math.ceil(viewportWidth / cardStep));
    const overscan = Math.max(3, visibleCount);
    const end = Math.min(count, Math.ceil((offset + viewportWidth) / cardStep) + overscan);

    return { start: Math.max(0, first - overscan), end };
};

export const isContentRowItemMounted = (
    index: number,
    window: ContentRowWindow,
    activeIndex: number,
) => index === activeIndex || (index >= window.start && index < window.end);

export const getContentRowActiveIndex = (
    keys: readonly string[],
    index: number,
    key: string | null,
) => {
    if (keys.length === 0) return -1;

    const keyedIndex = key === null ? -1 : keys.indexOf(key);
    return keyedIndex >= 0 ? keyedIndex : Math.max(0, Math.min(index, keys.length - 1));
};
