import { describe, expect, it, vi, beforeEach } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}),
}));

const repo = {
    listGroups: vi.fn(),
    listGroupedSeries: vi.fn(),
    insertGroup: vi.fn(),
    findGroupIdByBaseTitle: vi.fn(),
    groupExistsById: vi.fn(),
    seriesIdentityExists: vi.fn(),
    assignSeriesToGroup: vi.fn(),
    releaseSeriesFromGroup: vi.fn(),
    deleteGroup: vi.fn(),
};
vi.mock("@/lib/seriesGroups/seriesGroupRepository", () => repo);

const {
    listGroupsWithMembers,
    listGroupOptions,
    createGroup,
    assignSeriesToGroup,
    dissolveGroup,
} = await import("../seriesGroupService");

beforeEach(() => {
    vi.clearAllMocks();
    repo.listGroups.mockResolvedValue([]);
    repo.listGroupedSeries.mockResolvedValue([]);
});

describe("listGroupsWithMembers — grupowanie i osierocone wpisy", () => {
    it("przydziela serie do wlasciwej grupy po groupId", async () => {
        repo.listGroups.mockResolvedValue([{ id: 1, baseTitle: "One Piece", createdAt: 1000 }]);
        repo.listGroupedSeries.mockResolvedValue([
            { seriesKey: "OnePiece_S1", seriesId: 5, groupId: 1, seasonNumber: 1 },
        ]);

        await expect(listGroupsWithMembers()).resolves.toEqual({
            groups: [{ id: 1, baseTitle: "One Piece", createdAt: 1000, series: [{ seriesKey: "OnePiece_S1", seriesId: 5, seasonNumber: 1 }] }],
            orphans: [],
        });
    });

    it("group_id wskazujacy na nieistniejaca (usunieta) grupe -> ladowany do orphans, nie gubiony", async () => {
        repo.listGroups.mockResolvedValue([]);
        repo.listGroupedSeries.mockResolvedValue([
            { seriesKey: "Zjawa", seriesId: 9, groupId: 99, seasonNumber: null },
        ]);

        await expect(listGroupsWithMembers()).resolves.toEqual({
            groups: [],
            orphans: [{ seriesKey: "Zjawa", seriesId: 9, seasonNumber: null, groupId: 99 }],
        });
    });
});

describe("listGroupOptions — minimalne DTO dla dropdownu", () => {
    it("zwraca tylko id i baseTitle, bez createdAt/series", async () => {
        repo.listGroups.mockResolvedValue([{ id: 1, baseTitle: "One Piece", createdAt: 1000 }]);
        await expect(listGroupOptions()).resolves.toEqual([{ id: 1, baseTitle: "One Piece" }]);
    });
});

describe("createGroup — get-or-create po nazwie", () => {
    it("pusta nazwa -> invalid", async () => {
        await expect(createGroup("   ")).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.insertGroup).not.toHaveBeenCalled();
    });

    it("nazwa dluzsza niz 255 znakow -> invalid", async () => {
        await expect(createGroup("x".repeat(256))).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("nowa nazwa -> tworzy grupe, zwraca nowe id", async () => {
        repo.insertGroup.mockResolvedValue(7);
        await expect(createGroup("One Piece")).resolves.toEqual({ ok: true, id: 7, baseTitle: "One Piece" });
    });

    it("duplikat nazwy (ER_DUP_ENTRY -> conflict) -- zwraca istniejace id zamiast bledu", async () => {
        repo.insertGroup.mockRejectedValue(new DatabaseError("conflict", 409, "duplikat"));
        repo.findGroupIdByBaseTitle.mockResolvedValue(3);

        await expect(createGroup("One Piece")).resolves.toEqual({ ok: true, id: 3, baseTitle: "One Piece" });
    });

    it("konflikt, ale grupa zniknela miedzy INSERT a SELECT -- server", async () => {
        repo.insertGroup.mockRejectedValue(new DatabaseError("conflict", 409, "duplikat"));
        repo.findGroupIdByBaseTitle.mockResolvedValue(null);

        await expect(createGroup("One Piece")).resolves.toEqual({ ok: false, code: "server" });
    });
});

describe("assignSeriesToGroup — walidacja i istnienie zasobow", () => {
    it("pusty seriesKey -> invalid", async () => {
        await expect(assignSeriesToGroup("", 1, 2)).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("seasonNumber poza zakresem 1-999 -> invalid", async () => {
        await expect(assignSeriesToGroup("Naruto", 1, 0)).resolves.toEqual({ ok: false, code: "invalid" });
        await expect(assignSeriesToGroup("Naruto", 1, 1000)).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("seasonNumber=null jest dozwolony (odpiecie sezonu)", async () => {
        repo.seriesIdentityExists.mockResolvedValue(true);
        await expect(assignSeriesToGroup("Naruto", null, null)).resolves.toMatchObject({ ok: true, seasonNumber: null });
    });

    it("nieznany serial -> not_found, brak zapisu", async () => {
        repo.seriesIdentityExists.mockResolvedValue(false);
        await expect(assignSeriesToGroup("Nieznany", 1, 2)).resolves.toEqual({ ok: false, code: "not_found" });
        expect(repo.assignSeriesToGroup).not.toHaveBeenCalled();
    });

    it("nieznana grupa -> not_found, brak zapisu", async () => {
        repo.seriesIdentityExists.mockResolvedValue(true);
        repo.groupExistsById.mockResolvedValue(false);
        await expect(assignSeriesToGroup("Naruto", 99, 2)).resolves.toEqual({ ok: false, code: "not_found" });
        expect(repo.assignSeriesToGroup).not.toHaveBeenCalled();
    });

    it("sukces -- serial istnieje, grupa istnieje", async () => {
        repo.seriesIdentityExists.mockResolvedValue(true);
        repo.groupExistsById.mockResolvedValue(true);
        await expect(assignSeriesToGroup("Naruto", 1, 2)).resolves.toEqual({ ok: true, seriesKey: "Naruto", groupId: 1, seasonNumber: 2 });
    });
});

describe("dissolveGroup — atomowosc i rollback", () => {
    it("nieprawidlowy groupId -> invalid", async () => {
        await expect(dissolveGroup("abc")).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("nieznana grupa (0 usunietych wierszy) -> not_found", async () => {
        repo.releaseSeriesFromGroup.mockResolvedValue(0);
        repo.deleteGroup.mockResolvedValue(0);
        await expect(dissolveGroup(99)).resolves.toEqual({ ok: false, code: "not_found" });
    });

    it("sukces -- najpierw zwalnia serie z grupy, potem usuwa grupe, w tej samej transakcji", async () => {
        repo.releaseSeriesFromGroup.mockResolvedValue(3);
        repo.deleteGroup.mockResolvedValue(1);

        await expect(dissolveGroup(1)).resolves.toEqual({ ok: true, groupId: 1, releasedSeries: 3 });

        const releaseOrder = repo.releaseSeriesFromGroup.mock.invocationCallOrder[0];
        const deleteOrder = repo.deleteGroup.mock.invocationCallOrder[0];
        expect(releaseOrder).toBeLessThan(deleteOrder as number);
    });

    it("blad SQL w trakcie -> server, przerywa przed usunieciem grupy", async () => {
        repo.releaseSeriesFromGroup.mockRejectedValue(new DatabaseError("unknown", 500, "blad"));

        await expect(dissolveGroup(1)).resolves.toEqual({ ok: false, code: "server" });
        expect(repo.deleteGroup).not.toHaveBeenCalled();
    });
});
