import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { default: revalidateCatalogAction } = await import("../revalidateCatalogAction");

beforeEach(() => vi.clearAllMocks());

describe("revalidateCatalogAction", () => {
    it("odrzuca niezalogowanego bez unieważniania cache", async () => {
        getSessionUser.mockResolvedValue(null);

        await expect(revalidateCatalogAction()).resolves.toEqual({ success: false });
        expect(updateTag).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("odrzuca widza bez unieważniania cache", async () => {
        getSessionUser.mockResolvedValue({
            id: 1,
            username: "Widz",
            email: "widz@example.com",
            role: "viewer",
        });

        await expect(revalidateCatalogAction()).resolves.toEqual({ success: false });
        expect(updateTag).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("admin unieważnia lokalny cache katalogu bez wywołania PHP", async () => {
        getSessionUser.mockResolvedValue({
            id: 2,
            username: "Admin",
            email: "admin@example.com",
            role: "admin",
        });

        await expect(revalidateCatalogAction()).resolves.toEqual({ success: true });
        expect(updateTag).toHaveBeenCalledOnce();
        expect(updateTag).toHaveBeenCalledWith("catalog");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
