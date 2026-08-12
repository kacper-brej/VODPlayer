import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const {
    listGroups,
    listGroupedSeries,
    insertGroup,
    findGroupIdByBaseTitle,
    groupExistsById,
    seriesIdentityExists,
    assignSeriesToGroup,
    releaseSeriesFromGroup,
    deleteGroup,
} = await import("../seriesGroupRepository");

beforeEach(() => execute.mockReset());

describe("listGroups", () => {
    it("sortuje po base_title", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listGroups();
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY base_title/));
    });
});

describe("listGroupedSeries", () => {
    it("filtruje tylko serie z group_id ustawionym", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listGroupedSeries();
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/WHERE group_id IS NOT NULL/));
    });

    it("mapuje wiersze na GroupedSeriesRow (camelCase)", async () => {
        execute.mockResolvedValueOnce([[{ series_key: "Naruto", id: 5, group_id: 1, season_number: 2 }]]);
        await expect(listGroupedSeries()).resolves.toEqual([
            { seriesKey: "Naruto", seriesId: 5, groupId: 1, seasonNumber: 2 },
        ]);
    });
});

describe("insertGroup", () => {
    it("zwraca insertId", async () => {
        execute.mockResolvedValueOnce([{ insertId: 7 }]);
        await expect(insertGroup("One Piece")).resolves.toBe(7);
    });
});

describe("findGroupIdByBaseTitle", () => {
    it("brak dopasowania -> null", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(findGroupIdByBaseTitle("Nieznane")).resolves.toBeNull();
    });

    it("zwraca id istniejacej grupy", async () => {
        execute.mockResolvedValueOnce([[{ id: 3 }]]);
        await expect(findGroupIdByBaseTitle("One Piece")).resolves.toBe(3);
    });
});

describe("groupExistsById / seriesIdentityExists", () => {
    it("groupExistsById -> true gdy jest wiersz", async () => {
        execute.mockResolvedValueOnce([[{ id: 3 }]]);
        await expect(groupExistsById(3)).resolves.toBe(true);
    });

    it("seriesIdentityExists -> false gdy brak wiersza", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(seriesIdentityExists("Nieznany")).resolves.toBe(false);
    });
});

describe("assignSeriesToGroup", () => {
    it("aktualizuje group_id i season_number razem", async () => {
        execute.mockResolvedValueOnce([{}]);
        await assignSeriesToGroup("Naruto", 1, 2);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/UPDATE series_identities SET group_id = \?, season_number = \? WHERE series_key = \?/),
            [1, 2, "Naruto"],
        );
    });
});

describe("releaseSeriesFromGroup / deleteGroup — funkcje transakcyjne przyjmuja polaczenie wprost", () => {
    it("releaseSeriesFromGroup zeruje group_id i season_number wszystkich serii grupy", async () => {
        const connExecute = vi.fn().mockResolvedValueOnce([{ affectedRows: 2 }]);
        await expect(releaseSeriesFromGroup(1, { execute: connExecute } as never)).resolves.toBe(2);
        expect(connExecute).toHaveBeenCalledWith(
            expect.stringMatching(/SET group_id = NULL, season_number = NULL WHERE group_id = \?/),
            [1],
        );
        expect(execute).not.toHaveBeenCalled();
    });

    it("deleteGroup usuwa wiersz grupy na przekazanym polaczeniu", async () => {
        const connExecute = vi.fn().mockResolvedValueOnce([{ affectedRows: 1 }]);
        await expect(deleteGroup(1, { execute: connExecute } as never)).resolves.toBe(1);
        expect(execute).not.toHaveBeenCalled();
    });
});
