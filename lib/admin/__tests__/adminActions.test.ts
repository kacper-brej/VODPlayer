import { describe, expect, it, vi, beforeEach } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

const getAdminUsers = vi.fn();
vi.mock("@/lib/admin/adminUserService", () => ({ getAdminUsers }));

const getAdminLibrary = vi.fn();
vi.mock("@/lib/admin/adminLibraryService", () => ({ getAdminLibrary }));

const { getAdminLibraryAction, getAdminUsersAction } = await import("../adminActions");

beforeEach(() => vi.clearAllMocks());

describe("getAdminUsersAction — RBAC egzekwowane blisko operacji", () => {
    it("niezalogowany -> unauthorized, brak zapytania do bazy", async () => {
        getSessionUser.mockResolvedValue(null);
        await expect(getAdminUsersAction()).resolves.toMatchObject({ kind: "error", reason: "unauthorized" });
        expect(getAdminUsers).not.toHaveBeenCalled();
    });

    it("zalogowany widz (role=viewer) -> odrzucony jako forbidden, brak dostepu do listy uzytkownikow", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Widz", email: "w@example.com", role: "viewer" });
        await expect(getAdminUsersAction()).resolves.toMatchObject({ kind: "error", reason: "forbidden" });
        expect(getAdminUsers).not.toHaveBeenCalled();
    });

    it("admin -> przyjety, dostaje liste uzytkownikow", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Kacper", email: "k@example.com", role: "admin" });
        getAdminUsers.mockResolvedValue([{ id: 1, username: "Kacper", email: "k@example.com", emailVerified: true, role: "admin", createdAt: 1000 }]);

        const result = await getAdminUsersAction();

        expect(result).toEqual({
            kind: "success",
            data: { users: [{ id: 1, username: "Kacper", email: "k@example.com", emailVerified: true, role: "admin", createdAt: 1000 }] },
        });
    });
});

describe("getAdminLibraryAction", () => {
    it("odrzuca widza przed odczytem biblioteki", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Widz", email: "w@example.com", role: "viewer" });
        await expect(getAdminLibraryAction()).resolves.toMatchObject({ kind: "error", reason: "forbidden" });
        expect(getAdminLibrary).not.toHaveBeenCalled();
    });

    it("zwraca adminowi bibliotekę z DAL", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Admin", email: "a@example.com", role: "admin" });
        getAdminLibrary.mockResolvedValue({ series: [] });
        await expect(getAdminLibraryAction()).resolves.toEqual({ kind: "success", data: { series: [] } });
    });
});
