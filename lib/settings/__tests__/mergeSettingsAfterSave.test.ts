import { describe, expect, it } from "vitest";
import type { ProfileSettings } from "@/lib/core/contracts";
import { mergeSettingsAfterSave } from "../mergeSettingsAfterSave";

const settings = (overrides: Partial<ProfileSettings> = {}): ProfileSettings => ({
    autoplayNext: true,
    autoPreviewsEnabled: true,
    skipIntroPrompt: true,
    preferredSubtitleLang: "pl",
    preferredAudioLang: "en",
    defaultVolume: 80,
    reduceData: false,
    ...overrides,
});

describe("mergeSettingsAfterSave", () => {
    it("accepts normalized server values for fields that have not changed since submission", () => {
        const submitted = settings({ preferredAudioLang: "EN", preferredSubtitleLang: "PL" });
        const current = { ...submitted };
        const saved = settings();

        expect(mergeSettingsAfterSave(current, submitted, saved)).toEqual(saved);
    });

    it("retains edits made while saving and accepts normalization for untouched fields", () => {
        const submitted = settings({ preferredAudioLang: "EN" });
        const current = settings({ preferredAudioLang: "EN", defaultVolume: 35, reduceData: true });
        const saved = settings();

        expect(mergeSettingsAfterSave(current, submitted, saved)).toEqual(settings({
            defaultVolume: 35,
            reduceData: true,
        }));
    });

    it("preserves deliberate false, zero and null edits made after submission", () => {
        const submitted = settings();
        const current = settings({
            autoplayNext: false,
            autoPreviewsEnabled: false,
            skipIntroPrompt: false,
            defaultVolume: 0,
            preferredSubtitleLang: null,
            preferredAudioLang: null,
            reduceData: true,
        });

        expect(mergeSettingsAfterSave(current, submitted, settings())).toEqual(current);
    });

    it("accepts the saved value if the user has returned a field to its submitted value", () => {
        const submitted = settings({ preferredAudioLang: "EN" });
        const current = settings({ preferredAudioLang: "EN" });

        expect(mergeSettingsAfterSave(current, submitted, settings()).preferredAudioLang).toBe("en");
    });

    it("returns an independent result without mutating any input", () => {
        const current = Object.freeze(settings({ defaultVolume: 0 }));
        const submitted = Object.freeze(settings({ preferredAudioLang: "EN" }));
        const saved = Object.freeze(settings());
        const originalCurrent = { ...current };
        const originalSubmitted = { ...submitted };
        const originalSaved = { ...saved };

        const result = mergeSettingsAfterSave(current, submitted, saved);
        result.autoplayNext = false;

        expect(result).not.toBe(current);
        expect(result).not.toBe(submitted);
        expect(result).not.toBe(saved);
        expect(current).toEqual(originalCurrent);
        expect(submitted).toEqual(originalSubmitted);
        expect(saved).toEqual(originalSaved);
    });
});
