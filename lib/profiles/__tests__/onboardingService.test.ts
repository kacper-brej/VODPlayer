import { describe, expect, it, vi, beforeEach } from "vitest";

const FAKE_CONNECTION = { marker: "fake-connection" };

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work(FAKE_CONNECTION),
}));

const profileRepo = {
    listProfilesForUser: vi.fn(),
    countProfilesForUser: vi.fn(),
    isProfileOwnedByUser: vi.fn(),
    findDefaultProfileId: vi.fn(),
    insertDefaultProfile: vi.fn(),
    insertProfile: vi.fn(),
    renameProfileById: vi.fn(),
    updateProfileAvatarById: vi.fn(),
    isProfileDefault: vi.fn(),
    deleteProfileById: vi.fn(),
    promoteFirstProfileToDefault: vi.fn(),
};
vi.mock("@/lib/profiles/profileRepository", () => profileRepo);

const settingsRepo = { upsertProfileSettings: vi.fn() };
vi.mock("@/lib/settings/settingsRepository", () => settingsRepo);

const userRepo = { markUserOnboarded: vi.fn() };
vi.mock("@/lib/auth/userRepository", () => userRepo);

const selectedProfileId = vi.fn();
vi.mock("@/lib/core/vodConfig", () => ({ selectedProfileId }));

const { completeOnboarding, skipOnboarding } = await import("../onboardingService");
const { DatabaseError } = await import("@/lib/db/errors");

const USER_ID = 1;
const USERNAME = "Kacper";

const baseSettings = { autoplayNext: true, autoPreviewsEnabled: true, reduceData: false };

beforeEach(() => vi.clearAllMocks());

describe("completeOnboarding", () => {
    it("3 profile, domyslny jeszcze nie istnial -> tworzy go, zmienia nazwe/avatar, dokłada pozostałe dwa", async () => {
        profileRepo.findDefaultProfileId.mockResolvedValue(null);
        profileRepo.insertDefaultProfile.mockResolvedValue(1);
        profileRepo.insertProfile.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
        profileRepo.listProfilesForUser.mockResolvedValue([
            { id: 1, name: "Kacper", isDefault: true, avatar: "nx-01" },
            { id: 2, name: "Ala", isDefault: false, avatar: "nx-02" },
            { id: 3, name: "Bob", isDefault: false, avatar: null },
        ]);

        const result = await completeOnboarding(USER_ID, USERNAME, {
            profiles: [
                { name: "Kacper", avatar: "nx-01" },
                { name: "Ala", avatar: "nx-02" },
                { name: "Bob", avatar: null },
            ],
            settings: baseSettings,
        });

        expect(result.ok).toBe(true);
        expect(profileRepo.renameProfileById).toHaveBeenCalledWith(1, "Kacper", FAKE_CONNECTION);
        expect(profileRepo.updateProfileAvatarById).toHaveBeenCalledWith(1, "nx-01", FAKE_CONNECTION);
        expect(profileRepo.insertProfile).toHaveBeenNthCalledWith(1, USER_ID, "Ala", "nx-02", FAKE_CONNECTION);
        expect(profileRepo.insertProfile).toHaveBeenNthCalledWith(2, USER_ID, "Bob", null, FAKE_CONNECTION);
        expect(userRepo.markUserOnboarded).toHaveBeenCalledWith(USER_ID, FAKE_CONNECTION);
    });

    it("zapisuje preferencje na profilu domyslnym", async () => {
        profileRepo.findDefaultProfileId.mockResolvedValue(7);

        await completeOnboarding(USER_ID, USERNAME, {
            profiles: [{ name: "Kacper", avatar: null }],
            settings: { autoplayNext: false, autoPreviewsEnabled: true, reduceData: true },
        });

        expect(settingsRepo.upsertProfileSettings).toHaveBeenCalledWith(7, {
            autoplay_next: 0,
            auto_previews_enabled: 1,
            reduce_data: 1,
        }, FAKE_CONNECTION);
    });

    it("6 profili -> limit, zero zapisow", async () => {
        const result = await completeOnboarding(USER_ID, USERNAME, {
            profiles: Array.from({ length: 6 }, (_, index) => ({ name: `Profil ${index}`, avatar: null })),
            settings: baseSettings,
        });

        expect(result).toEqual({ ok: false, code: "limit" });
        expect(profileRepo.findDefaultProfileId).not.toHaveBeenCalled();
    });

    it("pusta lista profili -> empty", async () => {
        const result = await completeOnboarding(USER_ID, USERNAME, { profiles: [], settings: baseSettings });
        expect(result).toEqual({ ok: false, code: "empty" });
    });

    it("dwie nazwy rozniace sie tylko wielkoscia liter -> duplicate_name, zero zapisow", async () => {
        const result = await completeOnboarding(USER_ID, USERNAME, {
            profiles: [{ name: "Ala", avatar: null }, { name: "ala", avatar: null }],
            settings: baseSettings,
        });

        expect(result).toEqual({ ok: false, code: "duplicate_name" });
        expect(profileRepo.findDefaultProfileId).not.toHaveBeenCalled();
    });

    it("nieznany identyfikator avatara -> invalid_avatar", async () => {
        const result = await completeOnboarding(USER_ID, USERNAME, {
            profiles: [{ name: "Kacper", avatar: "nx-99" as never }],
            settings: baseSettings,
        });

        expect(result).toEqual({ ok: false, code: "invalid_avatar" });
    });

    it("pusta nazwa -> invalid_name", async () => {
        const result = await completeOnboarding(USER_ID, USERNAME, {
            profiles: [{ name: "   ", avatar: null }],
            settings: baseSettings,
        });

        expect(result).toEqual({ ok: false, code: "invalid_name" });
    });

    it("wyscig na UNIQUE(user_id, name) w trakcie transakcji -> duplicate_name, nie server", async () => {
        profileRepo.findDefaultProfileId.mockResolvedValue(1);
        profileRepo.insertProfile.mockRejectedValue(new DatabaseError("conflict", 409, "Rekord o tych danych już istnieje."));

        const result = await completeOnboarding(USER_ID, USERNAME, {
            profiles: [{ name: "Kacper", avatar: null }, { name: "Ala", avatar: null }],
            settings: baseSettings,
        });

        expect(result).toEqual({ ok: false, code: "duplicate_name" });
    });
});

describe("skipOnboarding", () => {
    it("zapewnia profil domyslny i ustawia znacznik, bez tworzenia dodatkowych profili", async () => {
        profileRepo.findDefaultProfileId.mockResolvedValue(1);

        const result = await skipOnboarding(USER_ID, USERNAME);

        expect(result).toEqual({ ok: true });
        expect(userRepo.markUserOnboarded).toHaveBeenCalledWith(USER_ID);
        expect(profileRepo.insertProfile).not.toHaveBeenCalled();
    });
});
