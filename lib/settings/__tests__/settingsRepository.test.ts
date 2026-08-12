import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { getProfileSettingsRow, upsertProfileSettings } = await import("../settingsRepository");

beforeEach(() => execute.mockReset());

describe("getProfileSettingsRow", () => {
    it("brak wiersza -> null", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(getProfileSettingsRow(5)).resolves.toBeNull();
    });

    it("mapuje TINYINT(1) na boolean, zachowuje liczby i null bez zmian", async () => {
        execute.mockResolvedValueOnce([[{
            autoplay_next: 1,
            auto_previews_enabled: 0,
            skip_intro_prompt: 0,
            preferred_subtitle_lang: "pl",
            preferred_audio_lang: null,
            default_volume: 80,
            reduce_data: 0,
        }]]);

        await expect(getProfileSettingsRow(5)).resolves.toEqual({
            autoplayNext: true,
            autoPreviewsEnabled: false,
            skipIntroPrompt: false,
            preferredSubtitleLang: "pl",
            preferredAudioLang: null,
            defaultVolume: 80,
            reduceData: false,
        });
    });
});

describe("upsertProfileSettings — dynamiczny UPDATE tylko dla przekazanych kolumn", () => {
    it("INSERT zawsze ma wszystkie kolumny (z defaultami), ale UPDATE tylko przekazane", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertProfileSettings(5, { default_volume: 80 });

        const [sql, params] = execute.mock.calls[0] as [string, unknown[]];
        expect(sql).toMatch(/INSERT INTO profile_settings/);
        expect(sql).toContain("default_volume = VALUES(default_volume)");
        expect(sql).not.toContain("autoplay_next = VALUES(autoplay_next)");
        expect(sql).toContain("updated_at = NOW()");
        expect(params).toContain(5);
        expect(params).toContain(80);
    });

    it("brak aktualizacji (pusty obiekt) -- INSERT wciaz uzupelnia domyslne wartosci profilu", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertProfileSettings(5, {});

        const [sql] = execute.mock.calls[0] as [string, unknown[]];
        expect(sql).not.toMatch(/autoplay_next = VALUES/);
        expect(sql).toContain("updated_at = NOW()");
    });

    it("wartosc false/0 jest przekazywana do SQL, nie pomijana jako falsy", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertProfileSettings(5, { reduce_data: 0, autoplay_next: 0 });

        const [, params] = execute.mock.calls[0] as [string, unknown[]];
        expect(params).toContain(0);
    });

    it("zapisuje preferencję automatycznych podglądów per profil", async () => {
        execute.mockResolvedValueOnce([{}]);
        await upsertProfileSettings(5, { auto_previews_enabled: 0 });

        const [sql, params] = execute.mock.calls[0] as [string, unknown[]];
        expect(sql).toContain("auto_previews_enabled = VALUES(auto_previews_enabled)");
        expect(params).toContain(0);
    });
});
