import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = {
    deleteDemoProgressForUser: vi.fn(),
    grantSeriesAccess: vi.fn(),
    listAllGrants: vi.fn(),
    loadVisibilityMap: vi.fn(),
    revokeSeriesAccess: vi.fn(),
    setSeriesVisibility: vi.fn(),
};
vi.mock("@/lib/access/seriesAccessRepository", () => repository);

const getDemoAsset = vi.fn();
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset }));

const listAdminLibrary = vi.fn();
vi.mock("@/lib/admin/adminLibraryRepository", () => ({ listAdminLibrary }));

const getAdminUsers = vi.fn();
vi.mock("@/lib/admin/adminUserService", () => ({ getAdminUsers }));

const {
    getSeriesAccessOverview,
    grantAccessAndDropDemoProgress,
} = await import("../accessControlService");

const DEMO = {
    assetId: 99, assetVersion: 1, seriesKey: "_demo", episodeKey: "01.mp4",
    durationSeconds: 600, heights: [480],
};

beforeEach(() => {
    vi.clearAllMocks();
    getAdminUsers.mockResolvedValue([{ id: 2, username: "widz", email: "c@d.pl", emailVerified: true, role: "viewer", createdAt: 1 }]);
    listAdminLibrary.mockResolvedValue({
        series: [
            { seriesKey: "Tokyo Ghoul", episodeCount: 1, totalBytes: 1, visibility: "restricted", episodes: [] },
            { seriesKey: "_demo", episodeCount: 1, totalBytes: 1, visibility: "system", episodes: [] },
        ],
    });
    repository.loadVisibilityMap.mockResolvedValue(new Map([["Tokyo Ghoul", "restricted"], ["_demo", "system"]]));
    repository.listAllGrants.mockResolvedValue([
        { seriesKey: "Tokyo Ghoul", userId: 2, grantedAt: 10 },
        { seriesKey: "_demo", userId: 2, grantedAt: 11 },
    ]);
    repository.deleteDemoProgressForUser.mockResolvedValue(3);
    getDemoAsset.mockResolvedValue(DEMO);
});

describe("przegląd dostępu dla panelu", () => {
    it("pomija materiał techniczny i jego uprawnienia", async () => {
        const overview = await getSeriesAccessOverview();

        expect(overview.series).toEqual([{ seriesKey: "Tokyo Ghoul", visibility: "restricted" }]);
        expect(overview.grants).toEqual([{ seriesKey: "Tokyo Ghoul", userId: 2, grantedAt: 10 }]);
    });

    it("tytuł bez wiersza widoczności pokazuje się jako restricted", async () => {
        listAdminLibrary.mockResolvedValue({
            series: [{ seriesKey: "Nowy", episodeCount: 1, totalBytes: 1, visibility: "restricted", episodes: [] }],
        });
        repository.loadVisibilityMap.mockResolvedValue(new Map());

        const overview = await getSeriesAccessOverview();

        expect(overview.series).toEqual([{ seriesKey: "Nowy", visibility: "restricted" }]);
    });
});

describe("nadanie dostępu", () => {
    it("czyści postęp zebrany na materiale demonstracyjnym", async () => {
        const result = await grantAccessAndDropDemoProgress("Tokyo Ghoul", 2, 1);

        expect(repository.grantSeriesAccess).toHaveBeenCalledWith("Tokyo Ghoul", 2, 1);
        expect(repository.deleteDemoProgressForUser).toHaveBeenCalledWith(2, "Tokyo Ghoul", DEMO.assetId);
        expect(result).toEqual({ removedProgressRows: 3 });
    });

    it("czyszczenie dotyczy wyłącznie tego serialu i tego konta", async () => {
        await grantAccessAndDropDemoProgress("Tokyo Ghoul", 2, 1);

        expect(repository.deleteDemoProgressForUser).toHaveBeenCalledTimes(1);
        expect(repository.deleteDemoProgressForUser).not.toHaveBeenCalledWith(expect.anything(), "_demo", expect.anything());
    });

    it("bez skonfigurowanego demo nadaje uprawnienie i nie próbuje czyścić", async () => {
        getDemoAsset.mockResolvedValue(null);

        const result = await grantAccessAndDropDemoProgress("Tokyo Ghoul", 2, 1);

        expect(repository.grantSeriesAccess).toHaveBeenCalledWith("Tokyo Ghoul", 2, 1);
        expect(repository.deleteDemoProgressForUser).not.toHaveBeenCalled();
        expect(result).toEqual({ removedProgressRows: 0 });
    });
});
