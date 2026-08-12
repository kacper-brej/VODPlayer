import { describe, expect, it, vi, beforeEach } from "vitest";

const listCurrentWeekPlayCounts = vi.fn();
vi.mock("@/lib/rankings/rankingRepository", () => ({ listCurrentWeekPlayCounts }));

const getCatalog = vi.fn();
vi.mock("@/lib/catalog/catalog", () => ({ getCatalog }));

const { getWeeklyRanking } = await import("../rankingService");

const seriesInCatalog = (...keys: string[]) => ({
    kind: "success",
    data: keys.map((key) => ({ key })),
});

beforeEach(() => {
    vi.clearAllMocks();
    getCatalog.mockResolvedValue(seriesInCatalog());
});

describe("getWeeklyRanking — pusty ranking", () => {
    it("brak wpisow play_counts w tym tygodniu -> pusta lista, katalog nie jest nawet potrzebny do decyzji", async () => {
        listCurrentWeekPlayCounts.mockResolvedValue([]);
        await expect(getWeeklyRanking()).resolves.toEqual([]);
    });
});

describe("getWeeklyRanking — filtrowanie wzgledem katalogu (zamiast is_dir z PHP)", () => {
    it("serial usuniety z biblioteki (brak w katalogu) jest pomijany, nie zajmuje miejsca w rankingu", async () => {
        listCurrentWeekPlayCounts.mockResolvedValue([
            { seriesKey: "Usuniety", playCount: 100 },
            { seriesKey: "Naruto", playCount: 50 },
        ]);
        getCatalog.mockResolvedValue(seriesInCatalog("Naruto"));

        await expect(getWeeklyRanking()).resolves.toEqual([
            { seriesKey: "Naruto", playCount: 50, rank: 1 },
        ]);
    });

    it("backfill: pominiecie nieistniejacego serialu odsuwa kolejny kandydat w gore rankingu", async () => {
        listCurrentWeekPlayCounts.mockResolvedValue([
            { seriesKey: "A", playCount: 100 },
            { seriesKey: "Usuniety", playCount: 90 },
            { seriesKey: "B", playCount: 80 },
        ]);
        getCatalog.mockResolvedValue(seriesInCatalog("A", "B"));

        await expect(getWeeklyRanking()).resolves.toEqual([
            { seriesKey: "A", playCount: 100, rank: 1 },
            { seriesKey: "B", playCount: 80, rank: 2 },
        ]);
    });

    it("blad katalogu -> lagodna degradacja, pozycje przechodza bez filtrowania (zamiast ukrywac caly ranking)", async () => {
        listCurrentWeekPlayCounts.mockResolvedValue([{ seriesKey: "Naruto", playCount: 10 }]);
        getCatalog.mockResolvedValue({ kind: "error", reason: "server" });

        await expect(getWeeklyRanking()).resolves.toEqual([{ seriesKey: "Naruto", playCount: 10, rank: 1 }]);
    });
});

describe("getWeeklyRanking — limit i kolejnosc", () => {
    it("limit 10 pozycji, ranga przypisywana po pozycji w juz posortowanej liscie z repo, bez ponownego sortowania w JS", async () => {
        const rows = Array.from({ length: 15 }, (_, i) => ({ seriesKey: `S${i}`, playCount: 100 - i }));
        listCurrentWeekPlayCounts.mockResolvedValue(rows);
        getCatalog.mockResolvedValue(seriesInCatalog(...rows.map((r) => r.seriesKey)));

        const result = await getWeeklyRanking();

        expect(result).toHaveLength(10);
        expect(result[0]).toEqual({ seriesKey: "S0", playCount: 100, rank: 1 });
        expect(result[9]).toEqual({ seriesKey: "S9", playCount: 91, rank: 10 });
    });

    it("remisy: kolejnosc z repo (juz rozstrzygnieta po series_key w SQL) jest zachowana 1:1", async () => {
        listCurrentWeekPlayCounts.mockResolvedValue([
            { seriesKey: "A", playCount: 5 },
            { seriesKey: "B", playCount: 5 },
        ]);
        getCatalog.mockResolvedValue(seriesInCatalog("A", "B"));

        await expect(getWeeklyRanking()).resolves.toEqual([
            { seriesKey: "A", playCount: 5, rank: 1 },
            { seriesKey: "B", playCount: 5, rank: 2 },
        ]);
    });
});
