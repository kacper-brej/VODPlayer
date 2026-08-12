import { describe, expect, it, vi, beforeEach } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

const repo = {
    countUnreadNotifications: vi.fn(),
    listUnreadNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
};
vi.mock("@/lib/notifications/notificationRepository", () => repo);

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));

const { getNotifications, markNotificationRead, markAllNotificationsRead } = await import("../notificationService");

const USER_ID = 1;
const USERNAME = "Kacper";
const PROFILE_ID = 5;

beforeEach(() => {
    vi.clearAllMocks();
    resolveOwnedProfileId.mockResolvedValue(PROFILE_ID);
    repo.countUnreadNotifications.mockResolvedValue(0);
    repo.listUnreadNotifications.mockResolvedValue([]);
});

describe("getNotifications", () => {
    it("deleguje rozwiazanie profilu, laczy count i items z tego samego profilu", async () => {
        repo.countUnreadNotifications.mockResolvedValue(2);
        repo.listUnreadNotifications.mockResolvedValue([
            { id: 1, seriesKey: "Naruto", episodeKey: "01.mp4", createdAt: 1000 },
        ]);

        const result = await getNotifications(USER_ID, USERNAME);

        expect(resolveOwnedProfileId).toHaveBeenCalledWith(USER_ID, USERNAME);
        expect(repo.countUnreadNotifications).toHaveBeenCalledWith(PROFILE_ID);
        expect(repo.listUnreadNotifications).toHaveBeenCalledWith(PROFILE_ID);
        expect(result).toEqual({ count: 2, items: [{ id: 1, seriesKey: "Naruto", episodeKey: "01.mp4", createdAt: 1000 }] });
    });
});

describe("markNotificationRead — walidacja i IDOR", () => {
    it("id=0, ujemne lub niecalkowite -> invalid, brak zapytania", async () => {
        await expect(markNotificationRead(USER_ID, USERNAME, 0)).resolves.toEqual({ ok: false, code: "invalid" });
        await expect(markNotificationRead(USER_ID, USERNAME, -1)).resolves.toEqual({ ok: false, code: "invalid" });
        await expect(markNotificationRead(USER_ID, USERNAME, 1.5)).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.markNotificationRead).not.toHaveBeenCalled();
    });

    it("zawsze uzywa profilu rozwiazanego z wlasnej sesji, nigdy przekazanego z zewnatrz", async () => {
        await markNotificationRead(USER_ID, USERNAME, 42);
        expect(repo.markNotificationRead).toHaveBeenCalledWith(42, PROFILE_ID);
    });

    it("cudze powiadomienie (0 affectedRows w SQL) -> nadal ok:true, nie ujawnia istnienia cudzego zasobu", async () => {
        repo.markNotificationRead.mockResolvedValue(0);
        await expect(markNotificationRead(USER_ID, USERNAME, 999)).resolves.toEqual({ ok: true });
    });

    it("blad bazy -> server", async () => {
        repo.markNotificationRead.mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));
        await expect(markNotificationRead(USER_ID, USERNAME, 1)).resolves.toEqual({ ok: false, code: "server" });
    });
});

describe("markAllNotificationsRead", () => {
    it("sukces", async () => {
        repo.markAllNotificationsRead.mockResolvedValue(3);
        await expect(markAllNotificationsRead(USER_ID, USERNAME)).resolves.toEqual({ ok: true });
        expect(repo.markAllNotificationsRead).toHaveBeenCalledWith(PROFILE_ID);
    });

    it("blad bazy -> server", async () => {
        repo.markAllNotificationsRead.mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));
        await expect(markAllNotificationsRead(USER_ID, USERNAME)).resolves.toEqual({ ok: false, code: "server" });
    });
});
