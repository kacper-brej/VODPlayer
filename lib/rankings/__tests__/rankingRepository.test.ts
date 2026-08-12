import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { listCurrentWeekPlayCounts } = await import("../rankingRepository");

beforeEach(() => execute.mockReset());

describe("listCurrentWeekPlayCounts", () => {
    it("filtruje po biezacym tygodniu (poniedzialek jako period_start) w samym SQL", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listCurrentWeekPlayCounts();
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/DATE_SUB\(CURDATE\(\), INTERVAL WEEKDAY\(CURDATE\(\)\) DAY\)/),
        );
    });

    it("sortuje po play_count malejaco, z remisami rozstrzyganymi po series_key rosnaco -- deterministyczne", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listCurrentWeekPlayCounts();
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/ORDER BY play_count DESC, series_key ASC/),
        );
    });

    it("mapuje wiersze na SeriesPlayCount (camelCase)", async () => {
        execute.mockResolvedValueOnce([[{ series_key: "Naruto", play_count: 12 }]]);
        await expect(listCurrentWeekPlayCounts()).resolves.toEqual([{ seriesKey: "Naruto", playCount: 12 }]);
    });
});
