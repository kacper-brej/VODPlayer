import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}),
}));

const repo = {
    listProfilesForUser: vi.fn(),
    countProfilesForUser: vi.fn(),
    isProfileOwnedByUser: vi.fn(),
    findDefaultProfileId: vi.fn(),
    insertDefaultProfile: vi.fn(),
    insertProfile: vi.fn(),
    renameProfileById: vi.fn(),
    updateProfileById: vi.fn(),
    isProfileDefault: vi.fn(),
    deleteProfileById: vi.fn(),
    promoteFirstProfileToDefault: vi.fn(),
};
vi.mock("@/lib/profiles/profileRepository", () => repo);

const selectedProfileId = vi.fn();
vi.mock("@/lib/core/vodConfig", () => ({ selectedProfileId }));

const { listProfiles, createProfile, updateProfile, renameProfile, deleteProfile, resolveOwnedProfileId } = await import("../profileService");
const { DatabaseError } = await import("@/lib/db/errors");

const USER_ID = 1;

beforeEach(() => vi.clearAllMocks());

describe("listProfiles", () => {
    it("brak profilu -> tworzy domyslny przed listowaniem (parytet z PHP resolveProfileId)", async () => {
        repo.findDefaultProfileId.mockResolvedValue(null);
        repo.listProfilesForUser.mockResolvedValue([{ id: 1, name: "Kacper", isDefault: true }]);

        const result = await listProfiles(USER_ID, "Kacper");

        expect(repo.insertDefaultProfile).toHaveBeenCalledWith(USER_ID, "Kacper", null, undefined);
        expect(result).toEqual([{ id: 1, name: "Kacper", isDefault: true }]);
    });

    it("profil juz istnieje -> nie tworzy drugiego domyslnego", async () => {
        repo.findDefaultProfileId.mockResolvedValue(5);
        repo.listProfilesForUser.mockResolvedValue([{ id: 5, name: "Kacper", isDefault: true }]);

        await listProfiles(USER_ID, "Kacper");

        expect(repo.insertDefaultProfile).not.toHaveBeenCalled();
    });
});

describe("createProfile", () => {
    it("wlasny sukces", async () => {
        repo.countProfilesForUser.mockResolvedValue(1);
        repo.insertProfile.mockResolvedValue(9);

        await expect(createProfile(USER_ID, "Dzieciak")).resolves.toEqual({
            ok: true, profile: { id: 9, name: "Dzieciak", isDefault: false, avatar: null },
        });
    });

    it("zapisuje wybrany awatar", async () => {
        repo.countProfilesForUser.mockResolvedValue(1);
        repo.insertProfile.mockResolvedValue(10);

        await expect(createProfile(USER_ID, "Kino", "nx-03")).resolves.toEqual({
            ok: true, profile: { id: 10, name: "Kino", isDefault: false, avatar: "nx-03" },
        });
        expect(repo.insertProfile).toHaveBeenCalledWith(USER_ID, "Kino", "nx-03");
    });

    it("zla nazwa (pusta) -> invalid bez dotykania bazy", async () => {
        await expect(createProfile(USER_ID, "   ")).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.countProfilesForUser).not.toHaveBeenCalled();
    });

    it("zla nazwa (za dluga, >50 znakow) -> invalid", async () => {
        await expect(createProfile(USER_ID, "x".repeat(51))).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("limit 5 profili -> limit, brak insertu", async () => {
        repo.countProfilesForUser.mockResolvedValue(5);
        await expect(createProfile(USER_ID, "Szosty")).resolves.toEqual({ ok: false, code: "limit" });
        expect(repo.insertProfile).not.toHaveBeenCalled();
    });

    it("duplikat nazwy -> conflict", async () => {
        repo.countProfilesForUser.mockResolvedValue(1);
        repo.insertProfile.mockRejectedValue(new DatabaseError("conflict", 409, "Rekord o tych danych już istnieje."));
        await expect(createProfile(USER_ID, "Kacper")).resolves.toEqual({ ok: false, code: "conflict" });
    });
});

describe("updateProfile — nazwa i awatar", () => {
    it("aktualizuje oba pola jednym zapytaniem dla wlasnego profilu", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(true);

        await expect(updateProfile(USER_ID, 5, "Wieczorny", "nx-07")).resolves.toEqual({
            ok: true,
            profile: { id: 5, name: "Wieczorny", avatar: "nx-07" },
        });
        expect(repo.updateProfileById).toHaveBeenCalledWith(5, "Wieczorny", "nx-07");
    });

    it("odrzuca nieznany awatar przed sprawdzeniem ownership", async () => {
        await expect(updateProfile(USER_ID, 5, "Wieczorny", "obcy-awatar")).resolves.toEqual({
            ok: false,
            code: "invalid_avatar",
        });
        expect(repo.isProfileOwnedByUser).not.toHaveBeenCalled();
        expect(repo.updateProfileById).not.toHaveBeenCalled();
    });

    it("nie pozwala edytowac obcego profilu", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(false);

        await expect(updateProfile(USER_ID, 999, "Przejety", "nx-01")).resolves.toEqual({
            ok: false,
            code: "forbidden",
        });
        expect(repo.updateProfileById).not.toHaveBeenCalled();
    });
});

describe("renameProfile — wlasny vs obcy profil (IDOR)", () => {
    it("wlasny profil -> sukces", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(true);
        await expect(renameProfile(USER_ID, 5, "Nowa nazwa")).resolves.toEqual({
            ok: true, profile: { id: 5, name: "Nowa nazwa" },
        });
        expect(repo.renameProfileById).toHaveBeenCalledWith(5, "Nowa nazwa");
    });

    it("OBCY profil (nalezy do innego usera) -> forbidden, ZERO zapytan UPDATE", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(false);
        await expect(renameProfile(USER_ID, 999, "Przejeta nazwa")).resolves.toEqual({ ok: false, code: "forbidden" });
        expect(repo.renameProfileById).not.toHaveBeenCalled();
    });

    it("zla nazwa -> invalid, nawet bez sprawdzania ownership (fail fast)", async () => {
        await expect(renameProfile(USER_ID, 5, "")).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("duplikat nazwy -> conflict", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(true);
        repo.renameProfileById.mockRejectedValue(new DatabaseError("conflict", 409, "..."));
        await expect(renameProfile(USER_ID, 5, "Zajeta")).resolves.toEqual({ ok: false, code: "conflict" });
    });
});

describe("deleteProfile", () => {
    it("brak profilu (obcy id) -> forbidden, bez dotykania reszty logiki", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(false);
        await expect(deleteProfile(USER_ID, 999)).resolves.toEqual({ ok: false, code: "forbidden" });
        expect(repo.countProfilesForUser).not.toHaveBeenCalled();
    });

    it("jedyny profil na koncie -> last_profile", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(true);
        repo.countProfilesForUser.mockResolvedValue(1);
        await expect(deleteProfile(USER_ID, 5)).resolves.toEqual({ ok: false, code: "last_profile" });
        expect(repo.deleteProfileById).not.toHaveBeenCalled();
    });

    it("usuniecie AKTYWNEGO (domyslnego) profilu -> promuje kolejny na domyslny", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(true);
        repo.countProfilesForUser.mockResolvedValue(2);
        repo.isProfileDefault.mockResolvedValue(true);

        await expect(deleteProfile(USER_ID, 5)).resolves.toEqual({ ok: true });

        expect(repo.deleteProfileById).toHaveBeenCalledWith(5, {});
        expect(repo.promoteFirstProfileToDefault).toHaveBeenCalledWith(USER_ID, {});
    });

    it("usuniecie NIE-domyslnego profilu -> nie promuje niczego", async () => {
        repo.isProfileOwnedByUser.mockResolvedValue(true);
        repo.countProfilesForUser.mockResolvedValue(2);
        repo.isProfileDefault.mockResolvedValue(false);

        await deleteProfile(USER_ID, 6);

        expect(repo.promoteFirstProfileToDefault).not.toHaveBeenCalled();
    });
});

describe("resolveOwnedProfileId — cookie nx_profile jest niezaufane", () => {
    it("cookie wskazuje na WLASNY profil -> uzywa go", async () => {
        selectedProfileId.mockResolvedValue("5");
        repo.isProfileOwnedByUser.mockResolvedValue(true);

        await expect(resolveOwnedProfileId(USER_ID, "Kacper")).resolves.toBe(5);
    });

    it("PROBA IDOR: cookie recznie zmienione na cudzy profil -> odrzucone, spada do domyslnego wlasnego", async () => {
        selectedProfileId.mockResolvedValue("999");
        repo.isProfileOwnedByUser.mockResolvedValue(false);
        repo.findDefaultProfileId.mockResolvedValue(5);

        await expect(resolveOwnedProfileId(USER_ID, "Kacper")).resolves.toBe(5);
        expect(repo.isProfileOwnedByUser).toHaveBeenCalledWith(999, USER_ID);
    });

    it("brak ciasteczka -> domyslny profil", async () => {
        selectedProfileId.mockResolvedValue(null);
        repo.findDefaultProfileId.mockResolvedValue(5);

        await expect(resolveOwnedProfileId(USER_ID, "Kacper")).resolves.toBe(5);
    });

    it("brak ciasteczka i brak jakiegokolwiek profilu -> tworzy domyslny", async () => {
        selectedProfileId.mockResolvedValue(null);
        repo.findDefaultProfileId.mockResolvedValue(null);
        repo.insertDefaultProfile.mockResolvedValue(42);

        await expect(resolveOwnedProfileId(USER_ID, "Kacper")).resolves.toBe(42);
    });

    it("ciasteczko z wartoscia nie-numeryczna (majstrowanie) -> ignorowane, nie wywoluje ownership check z NaN", async () => {
        selectedProfileId.mockResolvedValue("'; DROP TABLE profiles;--");
        repo.findDefaultProfileId.mockResolvedValue(5);

        await expect(resolveOwnedProfileId(USER_ID, "Kacper")).resolves.toBe(5);
        expect(repo.isProfileOwnedByUser).not.toHaveBeenCalled();
    });
});
