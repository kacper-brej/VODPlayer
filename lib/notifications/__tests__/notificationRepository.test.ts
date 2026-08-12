import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const {
    countUnreadNotifications,
    listUnreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    NOTIFICATIONS_LIST_LIMIT,
} = await import("../notificationRepository");

beforeEach(() => execute.mockReset());

describe("countUnreadNotifications", () => {
    it("liczy tylko nieprzeczytane (read_at IS NULL) tego profilu", async () => {
        execute.mockResolvedValueOnce([[{ count: 3 }]]);
        await expect(countUnreadNotifications(5)).resolves.toBe(3);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/WHERE profile_id = \? AND read_at IS NULL/),
            [5],
        );
    });
});

describe("listUnreadNotifications — limit i sortowanie", () => {
    it("domyslny limit to NOTIFICATIONS_LIST_LIMIT (paginacja/limit z kontraktu PHP)", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listUnreadNotifications(5);
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/LIMIT \?/), [5, NOTIFICATIONS_LIST_LIMIT]);
    });

    it("wlasny limit nadpisuje domyslny", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listUnreadNotifications(5, 10);
        expect(execute).toHaveBeenCalledWith(expect.any(String), [5, 10]);
    });

    it("sortuje po created_at malejaco", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listUnreadNotifications(5);
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY created_at DESC/), expect.any(Array));
    });

    it("mapuje wiersze na NotificationItem (camelCase)", async () => {
        execute.mockResolvedValueOnce([[
            { id: 1, series_key: "Naruto", episode_key: "01.mp4", created_at: 1000 },
        ]]);
        await expect(listUnreadNotifications(5)).resolves.toEqual([
            { id: 1, seriesKey: "Naruto", episodeKey: "01.mp4", createdAt: 1000 },
        ]);
    });
});

describe("markNotificationRead — wlasnosc wymuszona w SQL", () => {
    it("WHERE id=? AND profile_id=? AND read_at IS NULL -- obcy profil nigdy nie dopasuje wiersza", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        await markNotificationRead(1, 5);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/WHERE id = \? AND profile_id = \? AND read_at IS NULL/),
            [1, 5],
        );
    });

    it("brak dopasowania -> affectedRows 0, nie blad", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
        await expect(markNotificationRead(999, 5)).resolves.toBe(0);
    });
});

describe("markAllNotificationsRead", () => {
    it("oznacza tylko nieprzeczytane tego profilu", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 4 }]);
        await expect(markAllNotificationsRead(5)).resolves.toBe(4);
        expect(execute).toHaveBeenCalledWith(
            expect.stringMatching(/WHERE profile_id = \? AND read_at IS NULL/),
            [5],
        );
    });
});
