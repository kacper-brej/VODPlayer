export const setSeriesInfoId = (infoId: number | string | null): void => {
    const url = new URL(window.location.href);
    const value = infoId === null ? null : String(infoId);
    if (url.searchParams.get("info") === value) return;
    if (value === null) url.searchParams.delete("info");
    else url.searchParams.set("info", value);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
};
