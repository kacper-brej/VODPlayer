import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser, getUnreadNotificationsCount } = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getUnreadNotificationsCount: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/notifications/notificationService", () => ({
    getUnreadNotificationsCount,
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
}));

const { getUnreadNotificationsCountAction } = await import("../notificationsActions");

beforeEach(() => {
    vi.resetAllMocks();
    getSessionUser.mockResolvedValue({ id: 1, username: "Kacper" });
    getUnreadNotificationsCount.mockResolvedValue(0);
});

afterEach(() => vi.restoreAllMocks());

describe("getUnreadNotificationsCountAction", () => {
    it("returns the count for the authenticated user without the list loader", async () => {
        getUnreadNotificationsCount.mockResolvedValue(125);

        await expect(getUnreadNotificationsCountAction()).resolves.toBe(125);

        expect(getUnreadNotificationsCount).toHaveBeenCalledWith(1, "Kacper");
    });

    it("returns zero without reading notifications for an anonymous visitor", async () => {
        getSessionUser.mockResolvedValue(null);

        await expect(getUnreadNotificationsCountAction()).resolves.toBe(0);

        expect(getUnreadNotificationsCount).not.toHaveBeenCalled();
    });

    it("keeps the zero fallback when the profile or count query fails", async () => {
        const error = new Error("Database unavailable");
        getUnreadNotificationsCount.mockRejectedValue(error);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(getUnreadNotificationsCountAction()).resolves.toBe(0);

        expect(log).toHaveBeenCalledWith("getUnreadNotificationsCount failed:", error);
    });
});
