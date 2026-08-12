import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const {
    listEpisodeChaptersForEpisodes,
    listSeriesChapterDefaults,
    listEpisodeDurations,
    upsertSeriesChapterDefault,
    upsertEpisodeChapterInherited,
    upsertEpisodeChapterManual,
    deleteEpisodeChapter,
} = await import("../chapterRepository");

beforeEach(() => execute.mockReset());

describe("listEpisodeChaptersForEpisodes", () => {
    it("pusta lista kluczy -> pusty wynik bez zapytania SQL", async () => {
        await expect(listEpisodeChaptersForEpisodes("Naruto", [])).resolves.toEqual([]);
        expect(execute).not.toHaveBeenCalled();
    });

    it("generuje tyle placeholderow ile kluczy, sortuje po start_seconds", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listEpisodeChaptersForEpisodes("Naruto", ["01.mp4", "02.mp4"]);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/IN \(\?,\?\)[\s\S]*ORDER BY start_seconds ASC, end_seconds ASC/),
            ["Naruto", "01.mp4", "02.mp4"],
        );
    });

    it("mapuje wiersze na ChapterRow (camelCase)", async () => {
        execute.mockResolvedValueOnce([[
            { episode_key: "01.mp4", type: "intro", start_seconds: 0, end_seconds: 90, source: "manual" },
        ]]);
        await expect(listEpisodeChaptersForEpisodes("Naruto", ["01.mp4"])).resolves.toEqual([
            { episodeKey: "01.mp4", type: "intro", startSeconds: 0, endSeconds: 90, source: "manual" },
        ]);
    });
});

describe("listSeriesChapterDefaults", () => {
    it("zwraca rekord indeksowany typem rozdzialu", async () => {
        execute.mockResolvedValueOnce([[{ type: "intro", start_seconds: 0, end_seconds: 90 }]]);
        await expect(listSeriesChapterDefaults("Naruto")).resolves.toEqual({
            intro: { startSeconds: 0, endSeconds: 90 },
        });
    });
});

describe("listEpisodeDurations", () => {
    it("pusta lista kluczy -> pusty rekord bez zapytania SQL", async () => {
        await expect(listEpisodeDurations("Naruto", [])).resolves.toEqual({});
        expect(execute).not.toHaveBeenCalled();
    });

    it("pomija wiersze z duration_seconds=NULL (nieznany czas trwania)", async () => {
        execute.mockResolvedValueOnce([[
            { episode_key: "01.mp4", duration_seconds: 1200 },
            { episode_key: "02.mp4", duration_seconds: null },
        ]]);
        await expect(listEpisodeDurations("Naruto", ["01.mp4", "02.mp4"])).resolves.toEqual({ "01.mp4": 1200 });
    });
});

describe("upsertSeriesChapterDefault", () => {
    it("ON DUPLICATE KEY UPDATE po (series_key, type)", async () => {
        const connExecute = vi.fn().mockResolvedValueOnce([{}]);
        await upsertSeriesChapterDefault("Naruto", "intro", 0, 90, { execute: connExecute } as never);
        expect(connExecute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO series_chapter_defaults[\s\S]*ON DUPLICATE KEY UPDATE/),
            ["Naruto", "intro", 0, 90],
        );
    });
});

describe("upsertEpisodeChapterInherited — nie nadpisuje recznej korekty", () => {
    it("uzywa IF(source='manual', ...) zeby chronic override", async () => {
        const connExecute = vi.fn().mockResolvedValueOnce([{}]);
        await upsertEpisodeChapterInherited("Naruto", "01.mp4", "intro", 0, 90, { execute: connExecute } as never);
        const sql = connExecute.mock.calls[0]?.[0] as string;
        expect(sql).toMatch(/IF\(source = 'manual', start_seconds, VALUES\(start_seconds\)\)/);
        expect(sql).toContain("'inherited'");
    });
});

describe("upsertEpisodeChapterManual — zawsze nadpisuje", () => {
    it("source zawsze ustawiane na 'manual', bez warunku IF", async () => {
        const connExecute = vi.fn().mockResolvedValueOnce([{}]);
        await upsertEpisodeChapterManual("Naruto", "01.mp4", "intro", 0, 90, { execute: connExecute } as never);
        const sql = connExecute.mock.calls[0]?.[0] as string;
        expect(sql).not.toMatch(/IF\(/);
        expect(sql).toContain("source = 'manual'");
    });
});

describe("deleteEpisodeChapter", () => {
    it("usuwa po (series_key, episode_key, type), zwraca affectedRows", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        await expect(deleteEpisodeChapter("Naruto", "01.mp4", "intro")).resolves.toBe(1);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/WHERE series_key = \? AND episode_key = \? AND type = \?/),
            ["Naruto", "01.mp4", "intro"],
        );
    });

    it("brak dopasowania -> 0, nie blad", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
        await expect(deleteEpisodeChapter("Naruto", "99.mp4", "outro")).resolves.toBe(0);
    });
});
