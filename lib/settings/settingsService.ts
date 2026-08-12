import "server-only";
import { DatabaseError } from "@/lib/db/errors";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import type { ProfileSettings } from "@/lib/core/contracts";
import * as repo from "@/lib/settings/settingsRepository";
import type { SettingsColumnUpdates } from "@/lib/settings/settingsRepository";

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
    autoplayNext: true,
    autoPreviewsEnabled: true,
    skipIntroPrompt: true,
    preferredSubtitleLang: null,
    preferredAudioLang: null,
    defaultVolume: 100,
    reduceData: false,
};

const ALLOWED_LANGUAGE_CODES = new Set(["pl", "en", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "zh"]);

export const getSettings = async (userId: number, username: string): Promise<ProfileSettings> => {
    const profileId = await resolveOwnedProfileId(userId, username);
    const row = await repo.getProfileSettingsRow(profileId);
    return row ?? DEFAULT_PROFILE_SETTINGS;
};

export interface UpdateSettingsInput {
    autoplayNext?: boolean;
    autoPreviewsEnabled?: boolean;
    skipIntroPrompt?: boolean;
    preferredSubtitleLang?: string | null;
    preferredAudioLang?: string | null;
    defaultVolume?: number;
    reduceData?: boolean;
}

export type UpdateSettingsResult =
    | { ok: true; settings: ProfileSettings }
    | { ok: false; code: "invalid" | "server" };

const has = <T extends object>(input: T, key: keyof T): boolean => Object.prototype.hasOwnProperty.call(input, key);

const validateBool = (value: unknown): number | null => {
    if (typeof value !== "boolean") return null;
    return value ? 1 : 0;
};

const validateVolume = (value: unknown): number | null => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) return null;
    return value;
};

const validateLanguage = (value: unknown): { ok: true; value: string | null } | { ok: false } => {
    if (value === null) return { ok: true, value: null };
    if (typeof value !== "string" || !ALLOWED_LANGUAGE_CODES.has(value.toLowerCase())) return { ok: false };
    return { ok: true, value: value.toLowerCase() };
};

export const updateSettings = async (
    userId: number,
    username: string,
    input: UpdateSettingsInput,
): Promise<UpdateSettingsResult> => {
    const updates: SettingsColumnUpdates = {};

    if (has(input, "autoplayNext")) {
        const value = validateBool(input.autoplayNext);
        if (value === null) return { ok: false, code: "invalid" };
        updates.autoplay_next = value;
    }
    if (has(input, "autoPreviewsEnabled")) {
        const value = validateBool(input.autoPreviewsEnabled);
        if (value === null) return { ok: false, code: "invalid" };
        updates.auto_previews_enabled = value;
    }
    if (has(input, "skipIntroPrompt")) {
        const value = validateBool(input.skipIntroPrompt);
        if (value === null) return { ok: false, code: "invalid" };
        updates.skip_intro_prompt = value;
    }
    if (has(input, "preferredSubtitleLang")) {
        const result = validateLanguage(input.preferredSubtitleLang);
        if (!result.ok) return { ok: false, code: "invalid" };
        updates.preferred_subtitle_lang = result.value;
    }
    if (has(input, "preferredAudioLang")) {
        const result = validateLanguage(input.preferredAudioLang);
        if (!result.ok) return { ok: false, code: "invalid" };
        updates.preferred_audio_lang = result.value;
    }
    if (has(input, "defaultVolume")) {
        const value = validateVolume(input.defaultVolume);
        if (value === null) return { ok: false, code: "invalid" };
        updates.default_volume = value;
    }
    if (has(input, "reduceData")) {
        const value = validateBool(input.reduceData);
        if (value === null) return { ok: false, code: "invalid" };
        updates.reduce_data = value;
    }

    if (Object.keys(updates).length === 0) return { ok: false, code: "invalid" };

    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        await repo.upsertProfileSettings(profileId, updates);
        const row = await repo.getProfileSettingsRow(profileId);
        return { ok: true, settings: row ?? DEFAULT_PROFILE_SETTINGS };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
