import { describe, expect, it, vi, beforeEach } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

const getMediaStatus = vi.fn();
vi.mock("@/lib/admin/mediaStatusService", () => ({ getMediaStatus }));

const { getMediaStorageStatus } = await import("../mediaStorageStatus");

beforeEach(() => vi.clearAllMocks());

describe("getMediaStorageStatus — RBAC, bez HMAC (wywolanie wewnatrz procesu, nie miedzy uslugami)", () => {
    it("niezalogowany -> unauthorized", async () => {
        getSessionUser.mockResolvedValue(null);
        await expect(getMediaStorageStatus()).resolves.toMatchObject({ kind: "error", reason: "unauthorized" });
        expect(getMediaStatus).not.toHaveBeenCalled();
    });

    it("widz (nie-admin) -> forbidden", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Widz", email: "w@example.com", role: "viewer" });
        await expect(getMediaStorageStatus()).resolves.toMatchObject({ kind: "error", reason: "forbidden" });
        expect(getMediaStatus).not.toHaveBeenCalled();
    });

    it("admin -> dostaje dane", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Kacper", email: "k@example.com", role: "admin" });
        getMediaStatus.mockResolvedValue({ assets: [], lastVerification: null });
        await expect(getMediaStorageStatus()).resolves.toEqual({ kind: "success", data: { assets: [], lastVerification: null } });
    });
});
