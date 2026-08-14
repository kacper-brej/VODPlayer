import { describe, expect, it, vi, beforeEach } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

const captureStorageUsageSnapshot = vi.fn();
const getStorageUsage = vi.fn();
vi.mock("@/lib/admin/storageUsageService", () => ({
    captureStorageUsageSnapshot,
    getStorageUsage,
}));

const deleteMedia = vi.fn();
vi.mock("@/lib/admin/mediaDeleteService", () => ({ deleteMedia }));

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));

const { deleteAdminMediaAction, getStorageUsageAction } = await import("../adminStorageActions");

beforeEach(() => vi.clearAllMocks());

describe("getStorageUsageAction — RBAC egzekwowane blisko operacji", () => {
    it("niezalogowany -> unauthorized", async () => {
        getSessionUser.mockResolvedValue(null);
        await expect(getStorageUsageAction()).resolves.toMatchObject({ kind: "error", reason: "unauthorized" });
        expect(captureStorageUsageSnapshot).not.toHaveBeenCalled();
        expect(getStorageUsage).not.toHaveBeenCalled();
    });

    it("widz -> forbidden", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Widz", email: "w@example.com", role: "viewer" });
        await expect(getStorageUsageAction()).resolves.toMatchObject({ kind: "error", reason: "forbidden" });
        expect(captureStorageUsageSnapshot).not.toHaveBeenCalled();
        expect(getStorageUsage).not.toHaveBeenCalled();
    });

    it("admin -> zapisuje dzienną migawkę i dostaje dane", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Kacper", email: "k@example.com", role: "admin" });
        captureStorageUsageSnapshot.mockResolvedValue(undefined);
        getStorageUsage.mockResolvedValue({ currentTotalBytes: 1, currentMonthAverageBytes: 1, history: [] });
        await expect(getStorageUsageAction()).resolves.toMatchObject({ kind: "success" });
        expect(captureStorageUsageSnapshot).toHaveBeenCalledOnce();
        expect(getStorageUsage).toHaveBeenCalledOnce();
        expect(captureStorageUsageSnapshot.mock.invocationCallOrder[0])
            .toBeLessThan(getStorageUsage.mock.invocationCallOrder[0]);
    });

    it("błąd zapisu migawki nie blokuje odczytu panelu", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Kacper", email: "k@example.com", role: "admin" });
        captureStorageUsageSnapshot.mockRejectedValueOnce(new Error("snapshot unavailable"));
        getStorageUsage.mockResolvedValue({ currentTotalBytes: 1, currentMonthAverageBytes: 1, history: [] });

        await expect(getStorageUsageAction()).resolves.toMatchObject({ kind: "success" });
        expect(getStorageUsage).toHaveBeenCalledOnce();
    });
});

describe("deleteAdminMediaAction", () => {
    it("odrzuca nie-admina przed B2 i bazą", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Widz", email: "w@example.com", role: "viewer" });
        await expect(deleteAdminMediaAction("Test", "01.mp4")).resolves.toMatchObject({ kind: "error", reason: "forbidden" });
        expect(deleteMedia).not.toHaveBeenCalled();
    });

    it("usuwa media i unieważnia katalog", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Admin", email: "a@example.com", role: "admin" });
        deleteMedia.mockResolvedValue({ ok: true, existed: true, deletedB2Objects: 12 });
        await expect(deleteAdminMediaAction("Test", "01.mp4")).resolves.toEqual({
            kind: "success", data: { success: true, deletedB2Objects: 12 },
        });
        expect(deleteMedia).toHaveBeenCalledWith("Test", "01.mp4");
        expect(revalidateTag).toHaveBeenCalledWith("catalog", "max");
    });
});
