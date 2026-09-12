import { afterEach, describe, expect, it, vi } from "vitest";
import { setSeriesInfoId } from "../seriesInfoHistory";

const browserAt = (href: string) => {
    const location = { href };
    const pushState = vi.fn((_state: unknown, _title: string, value: string) => {
        location.href = new URL(value, location.href).href;
    });
    vi.stubGlobal("window", { location, history: { pushState } });
    return { location, pushState };
};

afterEach(() => vi.unstubAllGlobals());

describe("series info history", () => {
    it("opens details without dropping the current filters or hash", () => {
        const browser = browserAt("https://nocturna.test/explore?q=Za%C5%BC%C3%B3%C5%82%C4%87&genre=drama&page=2#catalog");
        setSeriesInfoId(1000021);
        const url = new URL(browser.location.href);
        expect(url.pathname).toBe("/explore");
        expect(url.searchParams.get("q")).toBe("Zażółć");
        expect(url.searchParams.get("genre")).toBe("drama");
        expect(url.searchParams.get("page")).toBe("2");
        expect(url.searchParams.get("info")).toBe("1000021");
        expect(url.hash).toBe("#catalog");
        expect(browser.pushState).toHaveBeenCalledTimes(1);
    });

    it("closes a directly linked dialog while retaining the other query parameters", () => {
        const browser = browserAt("https://nocturna.test/collections?collection=4&info=12#titles");
        setSeriesInfoId(null);
        expect(browser.pushState).toHaveBeenCalledExactlyOnceWith(null, "", "/collections?collection=4#titles");
    });

    it("does not create duplicate entries for an unchanged dialog", () => {
        const browser = browserAt("https://nocturna.test/?info=12");
        setSeriesInfoId(12);
        expect(browser.pushState).not.toHaveBeenCalled();
    });

    it("uses the live address for consecutive dialog changes", () => {
        const browser = browserAt("https://nocturna.test/");
        setSeriesInfoId(12);
        setSeriesInfoId(13);
        setSeriesInfoId(null);
        setSeriesInfoId(null);
        expect(browser.pushState.mock.calls.map((call) => call[2])).toEqual(["/?info=12", "/?info=13", "/"]);
    });
});
