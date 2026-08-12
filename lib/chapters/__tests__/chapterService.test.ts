import { describe, expect, it, vi, beforeEach } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}),
}));

const repo = {
    listEpisodeChaptersForEpisodes: vi.fn(),
    listSeriesChapterDefaults: vi.fn(),
    listEpisodeDurations: vi.fn(),
    upsertSeriesChapterDefault: vi.fn(),
    upsertEpisodeChapterInherited: vi.fn(),
    upsertEpisodeChapterManual: vi.fn(),
    deleteEpisodeChapter: vi.fn(),
};
vi.mock("@/lib/chapters/chapterRepository", () => repo);

const getCatalogSeriesByKey = vi.fn();
vi.mock("@/lib/catalog/catalog", () => ({ getCatalogSeriesByKey }));

const { getEpisodeChapters, saveChapter, deleteChapter } = await import("../chapterService");

beforeEach(() => {
    vi.clearAllMocks();
    repo.listEpisodeChaptersForEpisodes.mockResolvedValue([]);
    repo.listSeriesChapterDefaults.mockResolvedValue({});
    repo.listEpisodeDurations.mockResolvedValue({});
});

describe("getEpisodeChapters — dziedziczenie defaults i override", () => {
    it("brak wierszy i brak defaults -> pusta lista", async () => {
        await expect(getEpisodeChapters("Naruto", "01.mp4")).resolves.toEqual([]);
    });

    it("jawny wiersz episode_chapters wygrywa nad defaultem tego samego typu", async () => {
        repo.listEpisodeChaptersForEpisodes.mockResolvedValue([
            { episodeKey: "01.mp4", type: "intro", startSeconds: 5, endSeconds: 95, source: "manual" },
        ]);
        repo.listSeriesChapterDefaults.mockResolvedValue({ intro: { startSeconds: 0, endSeconds: 90 } });

        const result = await getEpisodeChapters("Naruto", "01.mp4");
        expect(result).toEqual([{ type: "intro", startSeconds: 5, endSeconds: 95 }]);
    });

    it("brak jawnego wiersza -> uzupelnia z series_chapter_defaults, przycina do duration", async () => {
        repo.listSeriesChapterDefaults.mockResolvedValue({ outro: { startSeconds: 1100, endSeconds: 1300 } });
        repo.listEpisodeDurations.mockResolvedValue({ "01.mp4": 1200 });

        const result = await getEpisodeChapters("Naruto", "01.mp4");
        expect(result).toEqual([{ type: "outro", startSeconds: 1100, endSeconds: 1200 }]);
    });

    it("default zaczyna sie po znanym czasie trwania -> pomijany calkowicie", async () => {
        repo.listSeriesChapterDefaults.mockResolvedValue({ outro: { startSeconds: 1300, endSeconds: 1400 } });
        repo.listEpisodeDurations.mockResolvedValue({ "01.mp4": 1200 });

        await expect(getEpisodeChapters("Naruto", "01.mp4")).resolves.toEqual([]);
    });

    it("nieznany czas trwania -> default uzyty bez przycinania", async () => {
        repo.listSeriesChapterDefaults.mockResolvedValue({ intro: { startSeconds: 0, endSeconds: 90 } });

        const result = await getEpisodeChapters("Naruto", "01.mp4");
        expect(result).toEqual([{ type: "intro", startSeconds: 0, endSeconds: 90 }]);
    });

    it("sortuje wynik po startSeconds", async () => {
        repo.listEpisodeChaptersForEpisodes.mockResolvedValue([
            { episodeKey: "01.mp4", type: "outro", startSeconds: 1100, endSeconds: 1200, source: "manual" },
            { episodeKey: "01.mp4", type: "intro", startSeconds: 0, endSeconds: 90, source: "manual" },
        ]);

        const result = await getEpisodeChapters("Naruto", "01.mp4");
        expect(result.map((c) => c.type)).toEqual(["intro", "outro"]);
    });
});

describe("saveChapter — walidacja wejscia", () => {
    it("pusty seriesKey/episodeKey -> invalid, brak zapytan", async () => {
        await expect(saveChapter("", "01.mp4", "intro", 0, 90, false)).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.listEpisodeDurations).not.toHaveBeenCalled();
    });

    it("klucz z separatorem sciezki -> invalid (ochrona przed traversal, mimo braku dostepu do FS z TS)", async () => {
        await expect(saveChapter("../etc", "01.mp4", "intro", 0, 90, false)).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("nieznany typ rozdzialu -> invalid", async () => {
        await expect(saveChapter("Naruto", "01.mp4", "credits", 0, 90, false)).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("startSeconds ujemny -> invalid", async () => {
        await expect(saveChapter("Naruto", "01.mp4", "intro", -1, 90, false)).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("startSeconds >= endSeconds -> invalid", async () => {
        await expect(saveChapter("Naruto", "01.mp4", "intro", 90, 90, false)).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("wartosc niecalkowita (float) -> invalid", async () => {
        await expect(saveChapter("Naruto", "01.mp4", "intro", 0, 90.5, false)).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("wartosc powyzej sufitu INT (2147483647) -> invalid", async () => {
        await expect(saveChapter("Naruto", "01.mp4", "intro", 0, 2147483648, false)).resolves.toEqual({ ok: false, code: "invalid" });
    });
});

describe("saveChapter — granica czasu trwania odcinka", () => {
    it("nieznany odcinek (brak duration_seconds) -> zapis przechodzi, walidacja pomijana lagodnie", async () => {
        await expect(saveChapter("Naruto", "99.mp4", "intro", 0, 999999, false)).resolves.toMatchObject({ ok: true });
        expect(repo.upsertEpisodeChapterManual).toHaveBeenCalled();
    });

    it("endSeconds przekracza znany czas trwania -> invalid, brak zapisu", async () => {
        repo.listEpisodeDurations.mockResolvedValue({ "01.mp4": 1200 });
        await expect(saveChapter("Naruto", "01.mp4", "outro", 1100, 1300, false)).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.upsertEpisodeChapterManual).not.toHaveBeenCalled();
    });

    it("endSeconds dokladnie rowny duration -> dozwolone (granica wlaczna)", async () => {
        repo.listEpisodeDurations.mockResolvedValue({ "01.mp4": 1200 });
        await expect(saveChapter("Naruto", "01.mp4", "outro", 1100, 1200, false)).resolves.toMatchObject({ ok: true });
    });
});

describe("saveChapter — niedozwolone nakladanie sie zakresow", () => {
    it("nowy zakres nakladajacy sie z innym jawnym typem tego odcinka -> overlap, brak zapisu", async () => {
        repo.listEpisodeChaptersForEpisodes.mockResolvedValue([
            { episodeKey: "01.mp4", type: "recap", startSeconds: 60, endSeconds: 150, source: "manual" },
        ]);

        await expect(saveChapter("Naruto", "01.mp4", "intro", 0, 90, false)).resolves.toEqual({ ok: false, code: "overlap" });
        expect(repo.upsertEpisodeChapterManual).not.toHaveBeenCalled();
    });

    it("ten sam typ nie koliduje sam ze soba (nadpisanie wlasnego zakresu jest dozwolone)", async () => {
        repo.listEpisodeChaptersForEpisodes.mockResolvedValue([
            { episodeKey: "01.mp4", type: "intro", startSeconds: 0, endSeconds: 90, source: "manual" },
        ]);

        await expect(saveChapter("Naruto", "01.mp4", "intro", 10, 100, false)).resolves.toMatchObject({ ok: true });
    });

    it("stykajace sie zakresy (koniec == poczatek) nie sa nakladaniem", async () => {
        repo.listEpisodeChaptersForEpisodes.mockResolvedValue([
            { episodeKey: "01.mp4", type: "intro", startSeconds: 0, endSeconds: 90, source: "manual" },
        ]);

        await expect(saveChapter("Naruto", "01.mp4", "recap", 90, 150, false)).resolves.toMatchObject({ ok: true });
    });

    it("nakladanie z dziedziczonym defaultem (bez jawnego wiersza) tez jest wykrywane", async () => {
        repo.listSeriesChapterDefaults.mockResolvedValue({ intro: { startSeconds: 0, endSeconds: 90 } });

        await expect(saveChapter("Naruto", "01.mp4", "recap", 50, 150, false)).resolves.toEqual({ ok: false, code: "overlap" });
    });
});

describe("saveChapter — applyToSeries: dziedziczenie i ochrona override", () => {
    it("bez applyToSeries: zapisuje tylko podany odcinek jako 'manual', bez defaultu serii", async () => {
        await saveChapter("Naruto", "01.mp4", "intro", 0, 90, false);

        expect(repo.upsertSeriesChapterDefault).not.toHaveBeenCalled();
        expect(repo.upsertEpisodeChapterManual).toHaveBeenCalledWith("Naruto", "01.mp4", "intro", 0, 90, {});
        expect(repo.upsertEpisodeChapterInherited).not.toHaveBeenCalled();
    });

    it("applyToSeries: rozwiazuje liste odcinkow z katalogu, dopisuje biezacy odcinek do zbioru", async () => {
        getCatalogSeriesByKey.mockResolvedValue({
            kind: "success",
            data: { episodes: [{ key: "01.mp4" }, { key: "02.mp4" }] },
        });

        const result = await saveChapter("Naruto", "03.mp4", "intro", 0, 90, true);

        expect(result).toMatchObject({ ok: true, affectedEpisodes: 3 });
        expect(repo.upsertSeriesChapterDefault).toHaveBeenCalledWith("Naruto", "intro", 0, 90, {});
        expect(repo.upsertEpisodeChapterInherited).toHaveBeenCalledTimes(3);
        expect(repo.upsertEpisodeChapterInherited).toHaveBeenCalledWith("Naruto", "03.mp4", "intro", 0, 90, {});
    });

    it("applyToSeries z katalogiem niedostepnym (blad/pusty) -> nadal zapisuje przynajmniej biezacy odcinek", async () => {
        getCatalogSeriesByKey.mockResolvedValue({ kind: "error", reason: "server" });

        const result = await saveChapter("Naruto", "01.mp4", "intro", 0, 90, true);

        expect(result).toMatchObject({ ok: true, affectedEpisodes: 1 });
        expect(repo.upsertEpisodeChapterInherited).toHaveBeenCalledWith("Naruto", "01.mp4", "intro", 0, 90, {});
    });

    it("applyToSeries uzywa upsertEpisodeChapterInherited (chroni reczny override), nie upsertEpisodeChapterManual", async () => {
        getCatalogSeriesByKey.mockResolvedValue({ kind: "success", data: { episodes: [] } });

        await saveChapter("Naruto", "01.mp4", "intro", 0, 90, true);

        expect(repo.upsertEpisodeChapterManual).not.toHaveBeenCalled();
        expect(repo.upsertEpisodeChapterInherited).toHaveBeenCalledOnce();
    });
});

describe("saveChapter — atomowosc / rollback", () => {
    it("blad SQL w trakcie zapisu wielu odcinkow -> caly zapis zwraca server, zaden pozniejszy upsert nie wystartowal", async () => {
        getCatalogSeriesByKey.mockResolvedValue({
            kind: "success",
            data: { episodes: [{ key: "01.mp4" }, { key: "02.mp4" }] },
        });
        repo.upsertEpisodeChapterInherited
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));

        const result = await saveChapter("Naruto", "01.mp4", "intro", 0, 90, true);

        expect(result).toEqual({ ok: false, code: "server" });
        expect(repo.upsertEpisodeChapterInherited).toHaveBeenCalledTimes(2);
    });
});

describe("deleteChapter", () => {
    it("nieprawidlowe dane wejsciowe -> invalid", async () => {
        await expect(deleteChapter("", "01.mp4", "intro")).resolves.toEqual({ ok: false, code: "invalid" });
        await expect(deleteChapter("Naruto", "01.mp4", "credits")).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.deleteEpisodeChapter).not.toHaveBeenCalled();
    });

    it("sukces -> zwraca liczbe usunietych wierszy", async () => {
        repo.deleteEpisodeChapter.mockResolvedValue(1);
        await expect(deleteChapter("Naruto", "01.mp4", "intro")).resolves.toEqual({ ok: true, deleted: 1 });
    });

    it("brak dopasowania -> sukces z deleted=0 (idempotentne, zgodnie z PHP)", async () => {
        repo.deleteEpisodeChapter.mockResolvedValue(0);
        await expect(deleteChapter("Naruto", "99.mp4", "outro")).resolves.toEqual({ ok: true, deleted: 0 });
    });

    it("blad bazy -> server", async () => {
        repo.deleteEpisodeChapter.mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));
        await expect(deleteChapter("Naruto", "01.mp4", "intro")).resolves.toEqual({ ok: false, code: "server" });
    });
});
