import { describe, expect, it, vi, beforeEach } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

const repo = {
    getProfileSettingsRow: vi.fn(),
    upsertProfileSettings: vi.fn(),
};
vi.mock("@/lib/settings/settingsRepository", () => repo);

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));

const { getSettings, updateSettings, DEFAULT_PROFILE_SETTINGS } = await import("../settingsService");

const USER_ID = 1;
const USERNAME = "Kacper";
const PROFILE_ID = 5;

beforeEach(() => {
    vi.clearAllMocks();
    resolveOwnedProfileId.mockResolvedValue(PROFILE_ID);
});

describe("getSettings — obcy profil chroniony przez M5", () => {
    it("deleguje rozwiazanie profilu, nigdy nie ufa surowemu ID", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await getSettings(USER_ID, USERNAME);
        expect(resolveOwnedProfileId).toHaveBeenCalledWith(USER_ID, USERNAME);
        expect(repo.getProfileSettingsRow).toHaveBeenCalledWith(PROFILE_ID);
    });

    it("brak wiersza w bazie -> wartosci domyslne", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await expect(getSettings(USER_ID, USERNAME)).resolves.toEqual(DEFAULT_PROFILE_SETTINGS);
    });
});

describe("updateSettings — rozroznienie 'brak pola' od 'jawny false/0/null'", () => {
    it("pusty obiekt -> invalid, brak zapytan do bazy", async () => {
        await expect(updateSettings(USER_ID, USERNAME, {})).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.upsertProfileSettings).not.toHaveBeenCalled();
    });

    it("tylko przekazane pole trafia do warstwy repo -- reszta w ogole nieobecna w obiekcie updates", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await updateSettings(USER_ID, USERNAME, { defaultVolume: 80 });

        expect(repo.upsertProfileSettings).toHaveBeenCalledWith(PROFILE_ID, { default_volume: 80 });
    });

    it("autoplayNext=false jest zapisywane jako 0, nie traktowane jak 'brak pola'", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await updateSettings(USER_ID, USERNAME, { autoplayNext: false });

        expect(repo.upsertProfileSettings).toHaveBeenCalledWith(PROFILE_ID, { autoplay_next: 0 });
    });

    it("autoPreviewsEnabled=false jest zapisywane dla aktywnego profilu", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await updateSettings(USER_ID, USERNAME, { autoPreviewsEnabled: false });

        expect(repo.upsertProfileSettings).toHaveBeenCalledWith(PROFILE_ID, { auto_previews_enabled: 0 });
    });

    it("defaultVolume=0 jest poprawna wartoscia, nie odrzucana jako falsy", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await expect(updateSettings(USER_ID, USERNAME, { defaultVolume: 0 })).resolves.toMatchObject({ ok: true });
        expect(repo.upsertProfileSettings).toHaveBeenCalledWith(PROFILE_ID, { default_volume: 0 });
    });

    it("preferredSubtitleLang=null jawnie czysci pole (rozne od nieprzekazania klucza)", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await updateSettings(USER_ID, USERNAME, { preferredSubtitleLang: null });

        expect(repo.upsertProfileSettings).toHaveBeenCalledWith(PROFILE_ID, { preferred_subtitle_lang: null });
    });

    it("kilka pol naraz -- wszystkie i tylko te trafiaja do updates", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await updateSettings(USER_ID, USERNAME, { reduceData: true, defaultVolume: 50 });

        expect(repo.upsertProfileSettings).toHaveBeenCalledWith(PROFILE_ID, { reduce_data: 1, default_volume: 50 });
    });
});

describe("updateSettings — walidacja", () => {
    it("defaultVolume ujemny -> invalid", async () => {
        await expect(updateSettings(USER_ID, USERNAME, { defaultVolume: -1 })).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("defaultVolume > 100 -> invalid", async () => {
        await expect(updateSettings(USER_ID, USERNAME, { defaultVolume: 101 })).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("defaultVolume niecalkowity -> invalid", async () => {
        await expect(updateSettings(USER_ID, USERNAME, { defaultVolume: 50.5 })).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("nieobslugiwany kod jezyka -> invalid", async () => {
        await expect(updateSettings(USER_ID, USERNAME, { preferredAudioLang: "xx" })).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("kod jezyka jest normalizowany do lowercase", async () => {
        repo.getProfileSettingsRow.mockResolvedValue(null);
        await updateSettings(USER_ID, USERNAME, { preferredAudioLang: "PL" });
        expect(repo.upsertProfileSettings).toHaveBeenCalledWith(PROFILE_ID, { preferred_audio_lang: "pl" });
    });

    it("autoplayNext nie-boolean -> invalid", async () => {
        await expect(updateSettings(USER_ID, USERNAME, { autoplayNext: 1 as unknown as boolean })).resolves.toEqual({ ok: false, code: "invalid" });
    });
});

describe("updateSettings — blad bazy", () => {
    it("DatabaseError z upsertu -> server", async () => {
        repo.upsertProfileSettings.mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));
        await expect(updateSettings(USER_ID, USERNAME, { defaultVolume: 50 })).resolves.toEqual({ ok: false, code: "server" });
    });
});
