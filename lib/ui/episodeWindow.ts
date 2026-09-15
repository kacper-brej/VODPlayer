export const EPISODE_WINDOW_THRESHOLD = 48;
export const INITIAL_EPISODE_ROWS = 6;

export const getMountedEpisodeRows = (
    rowCount: number,
    visibleRows: readonly number[] | null,
    focusedRow: number | null,
    overscan = 2,
) => {
    const rows = new Set<number>();
    const add = (row: number) => {
        if (row >= 0 && row < rowCount) rows.add(row);
    };
    if (visibleRows === null) {
        for (let row = 0; row < Math.min(INITIAL_EPISODE_ROWS, rowCount); row += 1) add(row);
    } else {
        for (const visible of visibleRows) {
            for (let row = visible - overscan; row <= visible + overscan; row += 1) add(row);
        }
    }
    if (focusedRow !== null) add(focusedRow);
    return rows;
};

export const episodeColumns = (width: number) => width >= 1280 ? 3 : width >= 1024 ? 2 : 1;

export const estimateEpisodeRowHeight = (width: number, columns: number, gap: number) =>
    Math.max(120, ((width - gap * (columns - 1)) / columns) * 9 / 16 + 114);

export const findVisibleEpisodeRow = (
    rowCount: number,
    readBounds: (index: number) => { top: number; bottom: number } | undefined,
    viewportTop: number,
    viewportBottom: number,
): number | null => {
    let first = 0;
    let last = rowCount;
    while (first < last) {
        const middle = Math.floor((first + last) / 2);
        const bounds = readBounds(middle);
        if (!bounds) return null;
        if (bounds.bottom <= viewportTop) first = middle + 1;
        else last = middle;
    }
    if (first >= rowCount) return null;
    const bounds = readBounds(first);
    return bounds && bounds.top < viewportBottom ? first : null;
};
