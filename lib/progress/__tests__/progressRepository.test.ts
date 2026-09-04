import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));
const { findReadyMediaAsset, loadProgressSnapshot, markPlayCountedToday, upsertWatchProgress } = await import("../progressRepository");
const connection = { execute } as never;

beforeEach(() => execute.mockReset());

describe("progress read model", () => {
    it("pobiera wiele serii jednym zapytaniem i nie czyta continue_watching", async () => {
        execute.mockResolvedValueOnce([[]]);
        await loadProgressSnapshot(5, ["A", "B", "A"]);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/FROM watch_progress[\s\S]+INNER JOIN media_assets/), [5, "A", "B"]);
        expect(execute.mock.calls[0]?.[0]).not.toContain("continue_watching");
    });

    it("wyklucza completed z Continue Watching i wybiera najnowszy nieukończony per seria", async () => {
        execute.mockResolvedValueOnce([[
            { series_key: "A", episode_key: "03", position_seconds: 1100, duration_seconds: 1200, completed: 1, updated_at: 30 },
            { series_key: "A", episode_key: "02", position_seconds: 200, duration_seconds: 1200, completed: 0, updated_at: 20 },
            { series_key: "A", episode_key: "01", position_seconds: 100, duration_seconds: 1200, completed: 0, updated_at: 10 },
        ]]);
        const result = await loadProgressSnapshot(5);
        expect(result.resumes).toEqual([{ seriesKey: "A", episodeKey: "02", positionSeconds: 200, durationSeconds: 1200, updatedAt: 20 }]);
        expect(result.episodesBySeries.A?.["03"]?.completed).toBe(true);
    });

    it("pokazuje nieukończony plik w Continue Watching bez znanego duration", async () => {
        execute.mockResolvedValueOnce([[
            { series_key: "A", episode_key: "01", position_seconds: 321, duration_seconds: null, completed: 0, updated_at: 20 },
        ]]);

        const result = await loadProgressSnapshot(5);

        expect(result.resumes).toEqual([{
            seriesKey: "A",
            episodeKey: "01",
            positionSeconds: 321,
            durationSeconds: null,
            updatedAt: 20,
        }]);
    });

    it("filtr profilu jest parametrem pierwszego i jedynego zapytania", async () => {
        execute.mockResolvedValueOnce([[]]);
        await loadProgressSnapshot(77);
        expect(execute.mock.calls[0]?.[1]).toEqual([77]);
    });
});

describe("progress write model", () => {
    it("akceptuje gotowy asset z serwerowym duration", async () => {
        execute.mockResolvedValueOnce([[{ id: 8, asset_version: 3, series_key: "A", episode_key: "01", duration_seconds: 1200 }]]);
        await expect(findReadyMediaAsset("A", "01")).resolves.toEqual({ id: 8, version: 3, seriesKey: "A", episodeKey: "01", durationSeconds: 1200 });
        expect(execute.mock.calls[0]?.[0]).toMatch(/status = 'ready'/);
        expect(execute.mock.calls[0]?.[0]).not.toContain("duration_seconds IS NOT NULL");
    });

    it("zwraca gotowy asset plikowy, nawet gdy serwer nie zna jeszcze duration", async () => {
        execute.mockResolvedValueOnce([[{ id: 9, asset_version: 1, series_key: "A", episode_key: "02", duration_seconds: null }]]);
        await expect(findReadyMediaAsset("A", "02")).resolves.toEqual({
            id: 9,
            version: 1,
            seriesKey: "A",
            episodeKey: "02",
            durationSeconds: null,
        });
    });

    it("upsert wiąże rekord z assetem i completion nigdy nie znika przy zwykłym seeku", async () => {
        execute.mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ completed: 1 }]]);
        const asset = { id: 8, version: 3, seriesKey: "A", episodeKey: "01", durationSeconds: 1200 };
        await expect(upsertWatchProgress(5, asset, 100, false, connection)).resolves.toBe(true);
        expect(execute.mock.calls[0]?.[0]).toMatch(/GREATEST\(completed, VALUES\(completed\)\)/);
        expect(execute.mock.calls[0]?.[1]).toEqual([5, 8, 3, "A", "01", 100, 1200, 0]);
    });

    it("ten sam asset pod dwoma serialami zapisuje dwa niezależne wiersze", async () => {
        const shared = { id: 99, version: 1, durationSeconds: 600 };
        execute
            .mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ completed: 0 }]])
            .mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ completed: 0 }]]);

        await upsertWatchProgress(5, { ...shared, seriesKey: "Tokyo Ghoul", episodeKey: "01.mp4" }, 300, false, connection);
        await upsertWatchProgress(5, { ...shared, seriesKey: "My Hero Academia", episodeKey: "01.mp4" }, 120, false, connection);

        expect(execute.mock.calls[0]?.[1]).toEqual([5, 99, 1, "Tokyo Ghoul", "01.mp4", 300, 600, 0]);
        expect(execute.mock.calls[2]?.[1]).toEqual([5, 99, 1, "My Hero Academia", "01.mp4", 120, 600, 0]);
    });

    it("odczyt ukończenia jest kluczowany po odcinku, nie po assecie", async () => {
        execute.mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ completed: 1 }]]);
        const asset = { id: 99, version: 1, seriesKey: "Tokyo Ghoul", episodeKey: "02.mp4", durationSeconds: 600 };

        await upsertWatchProgress(5, asset, 590, true, connection);

        expect(execute.mock.calls[1]?.[1]).toEqual([5, "Tokyo Ghoul", "02.mp4"]);
        expect(execute.mock.calls[1]?.[0]).not.toContain("media_asset_id");
    });

    it("ranking jest oznaczany atomowo per profil i konkretny odcinek", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        await expect(markPlayCountedToday(5, "A", "01", connection)).resolves.toBe(true);
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("last_counted_on"), [5, "A", "01"]);
    });
});
