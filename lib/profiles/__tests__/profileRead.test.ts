import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async () => {
    const { createRequire } = await import("node:module");
    const { dirname, join } = await import("node:path");
    const require = createRequire(import.meta.url);
    return require(join(dirname(require.resolve("react")), "cjs/react.react-server.development.js"));
});

const mocks = vi.hoisted(() => ({
    selectedProfileId: vi.fn(),
    getSessionUser: vi.fn(),
    profiles: {
        isProfileOwnedByUser: vi.fn(),
        findDefaultProfileId: vi.fn(),
        insertDefaultProfile: vi.fn(),
    },
    settings: {
        getProfileSettingsRow: vi.fn(),
        upsertProfileSettings: vi.fn(),
    },
    progress: {
        loadProgressSnapshot: vi.fn(),
        findReadyMediaAsset: vi.fn(),
        upsertWatchProgress: vi.fn(),
        resetWatchProgressForRewatch: vi.fn(),
    },
    watchlist: {
        listWatchlistForProfile: vi.fn(),
        upsertWatchlistItem: vi.fn(),
        deleteWatchlistItem: vi.fn(),
    },
    notifications: {
        countUnreadNotifications: vi.fn(),
        listUnreadNotifications: vi.fn(),
        markNotificationRead: vi.fn(),
        markAllNotificationsRead: vi.fn(),
    },
}));

vi.mock("@/lib/core/vodConfig", () => ({ selectedProfileId: mocks.selectedProfileId }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/profiles/profileRepository", () => mocks.profiles);
vi.mock("@/lib/settings/settingsRepository", () => mocks.settings);
vi.mock("@/lib/progress/progressRepository", () => mocks.progress);
vi.mock("@/lib/watchlist/watchlistRepository", () => mocks.watchlist);
vi.mock("@/lib/notifications/notificationRepository", () => mocks.notifications);
vi.mock("@/lib/access/entitlements", () => ({ getViewerSeriesAccessLevel: async () => "full" }));
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset: async () => null }));
vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}),
}));

const serverReact = await import("react") as unknown as {
    __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
        A: { getCacheForType: <T>(factory: () => T) => T } | null;
    };
};
const internals = serverReact.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
const { resolveOwnedProfileIdForRead } = await import("../profileRead");
const { getSettings, updateSettings } = await import("@/lib/settings/settingsService");
const { getSettings: getSettingsForPage } = await import("@/lib/settings/settings");
const { getProgressSnapshot, saveProgress, resetProgressForRewatch } = await import("@/lib/progress/progressService");
const { getWatchlist, addToWatchlist, removeFromWatchlist } = await import("@/lib/watchlist/watchlistService");
const { getNotifications, markNotificationRead, markAllNotificationsRead } = await import("@/lib/notifications/notificationService");

const startRender = () => {
    const entries = new Map<() => unknown, unknown>();
    internals.A = {
        getCacheForType<T>(factory: () => T): T {
            if (!entries.has(factory)) entries.set(factory, factory());
            return entries.get(factory) as T;
        },
    };
};

const readProfileData = () => Promise.all([
    getSettings(1, "Kacper"),
    getProgressSnapshot(1, "Kacper"),
    getWatchlist(1, "Kacper"),
    getNotifications(1, "Kacper"),
]);

beforeEach(() => {
    vi.resetAllMocks();
    startRender();
    mocks.selectedProfileId.mockResolvedValue("5");
    mocks.getSessionUser.mockResolvedValue({ id: 1, username: "Kacper" });
    mocks.profiles.isProfileOwnedByUser.mockResolvedValue(true);
    mocks.profiles.findDefaultProfileId.mockResolvedValue(7);
    mocks.settings.getProfileSettingsRow.mockResolvedValue(null);
    mocks.progress.loadProgressSnapshot.mockResolvedValue({ episodesBySeries: {}, resumes: [] });
    mocks.progress.findReadyMediaAsset.mockResolvedValue({
        id: 8, seriesKey: "Naruto", episodeKey: "01.mp4", durationSeconds: 1200,
    });
    mocks.progress.upsertWatchProgress.mockResolvedValue(false);
    mocks.watchlist.listWatchlistForProfile.mockResolvedValue([]);
    mocks.notifications.countUnreadNotifications.mockResolvedValue(0);
    mocks.notifications.listUnreadNotifications.mockResolvedValue([]);
});

afterEach(() => {
    internals.A = null;
});

describe("profile reads during server rendering", () => {
    it("shares one cookie and ownership lookup across concurrent read services", async () => {
        await readProfileData();

        expect(mocks.selectedProfileId).toHaveBeenCalledTimes(1);
        expect(mocks.profiles.isProfileOwnedByUser).toHaveBeenCalledExactlyOnceWith(5, 1);
        expect(mocks.settings.getProfileSettingsRow).toHaveBeenCalledWith(5);
        expect(mocks.progress.loadProgressSnapshot).toHaveBeenCalledWith(5, undefined);
        expect(mocks.watchlist.listWatchlistForProfile).toHaveBeenCalledWith(5);
        expect(mocks.notifications.countUnreadNotifications).toHaveBeenCalledWith(5);
    });

    it("does not reuse another user's ownership result in the same render", async () => {
        mocks.profiles.isProfileOwnedByUser.mockImplementation(async (_profileId: number, userId: number) => userId === 1);
        mocks.profiles.findDefaultProfileId.mockResolvedValue(22);

        await expect(resolveOwnedProfileIdForRead(1, "Kacper")).resolves.toBe(5);
        await expect(resolveOwnedProfileIdForRead(2, "Second user")).resolves.toBe(22);

        expect(mocks.profiles.isProfileOwnedByUser).toHaveBeenCalledWith(5, 2);
        expect(mocks.profiles.findDefaultProfileId).toHaveBeenCalledWith(2, undefined);
    });

    it("reads the selected profile and ownership again on the next request", async () => {
        await expect(resolveOwnedProfileIdForRead(1, "Kacper")).resolves.toBe(5);
        mocks.selectedProfileId.mockResolvedValue("9");
        startRender();

        await expect(resolveOwnedProfileIdForRead(1, "Kacper")).resolves.toBe(9);

        expect(mocks.profiles.isProfileOwnedByUser).toHaveBeenCalledTimes(2);
        expect(mocks.profiles.isProfileOwnedByUser).toHaveBeenLastCalledWith(9, 1);
    });

    it("falls back to an owned default for a forged cookie before querying profile data", async () => {
        mocks.selectedProfileId.mockResolvedValue("999");
        mocks.profiles.isProfileOwnedByUser.mockResolvedValue(false);

        await readProfileData();

        expect(mocks.profiles.isProfileOwnedByUser).toHaveBeenCalledExactlyOnceWith(999, 1);
        expect(mocks.profiles.findDefaultProfileId).toHaveBeenCalledTimes(1);
        expect(mocks.progress.loadProgressSnapshot).toHaveBeenCalledWith(7, undefined);
        expect(mocks.watchlist.listWatchlistForProfile).toHaveBeenCalledWith(7);
    });

    it("creates at most one default profile for simultaneous reads with no profile cookie", async () => {
        mocks.selectedProfileId.mockResolvedValue(null);
        mocks.profiles.findDefaultProfileId.mockResolvedValue(null);
        mocks.profiles.insertDefaultProfile.mockResolvedValue(44);

        await readProfileData();

        expect(mocks.profiles.insertDefaultProfile).toHaveBeenCalledExactlyOnceWith(1, "Kacper", null, undefined);
        expect(mocks.progress.loadProgressSnapshot).toHaveBeenCalledWith(44, undefined);
    });

    it("does not reuse profile checks outside a React server render", async () => {
        internals.A = null;
        await resolveOwnedProfileIdForRead(1, "Kacper");
        mocks.selectedProfileId.mockResolvedValue("9");

        await expect(resolveOwnedProfileIdForRead(1, "Kacper")).resolves.toBe(9);

        expect(mocks.profiles.isProfileOwnedByUser).toHaveBeenCalledTimes(2);
    });

    it("keeps progress reads fresh while sharing only the profile lookup", async () => {
        await getProgressSnapshot(1, "Kacper");
        const updated = { episodesBySeries: { Naruto: {} }, resumes: [] };
        mocks.progress.loadProgressSnapshot.mockResolvedValue(updated);

        await expect(getProgressSnapshot(1, "Kacper")).resolves.toBe(updated);

        expect(mocks.profiles.isProfileOwnedByUser).toHaveBeenCalledTimes(1);
        expect(mocks.progress.loadProgressSnapshot).toHaveBeenCalledTimes(2);
    });

    it("shares the settings row between layout and page loaders within a render", async () => {
        await Promise.all([getSettingsForPage(), getSettingsForPage()]);

        expect(mocks.settings.getProfileSettingsRow).toHaveBeenCalledTimes(1);

        startRender();
        await getSettingsForPage();

        expect(mocks.settings.getProfileSettingsRow).toHaveBeenCalledTimes(2);
    });

    it("rechecks ownership for every mutation even after a cached read", async () => {
        await readProfileData();
        mocks.selectedProfileId.mockResolvedValue("999");
        mocks.profiles.isProfileOwnedByUser.mockResolvedValue(false);

        await Promise.all([
            updateSettings(1, "Kacper", { defaultVolume: 50 }),
            addToWatchlist(1, "Kacper", "Naruto"),
            removeFromWatchlist(1, "Kacper", "Naruto"),
            saveProgress(1, "Kacper", { series: "Naruto", episode: "01.mp4", position: 10 }),
            resetProgressForRewatch(1, "Kacper", "Naruto", "01.mp4"),
            markNotificationRead(1, "Kacper", 42),
            markAllNotificationsRead(1, "Kacper"),
        ]);

        expect(mocks.profiles.isProfileOwnedByUser).toHaveBeenCalledTimes(8);
        expect(mocks.profiles.findDefaultProfileId).toHaveBeenCalledTimes(7);
        expect(mocks.settings.upsertProfileSettings).toHaveBeenCalledWith(7, { default_volume: 50 });
        expect(mocks.watchlist.upsertWatchlistItem).toHaveBeenCalledWith(7, "Naruto");
        expect(mocks.watchlist.deleteWatchlistItem).toHaveBeenCalledWith(7, "Naruto");
        expect(mocks.progress.upsertWatchProgress.mock.calls[0][0]).toBe(7);
        expect(mocks.progress.resetWatchProgressForRewatch).toHaveBeenCalledWith(7, "Naruto", "01.mp4", {});
        expect(mocks.notifications.markNotificationRead).toHaveBeenCalledWith(42, 7);
        expect(mocks.notifications.markAllNotificationsRead).toHaveBeenCalledWith(7);
    });
});
