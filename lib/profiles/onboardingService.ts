import "server-only";
import { withTransaction } from "@/lib/db/transaction";
import { DatabaseError } from "@/lib/db/errors";
import type { Profile } from "@/lib/core/contracts";
import {
    MAX_PROFILES_PER_ACCOUNT,
    isProfileAvatar,
    type OnboardingErrorCode,
    type OnboardingInput,
    type ProfileAvatar,
} from "@/lib/core/onboarding";
import { ensureDefaultProfile, validateProfileName } from "@/lib/profiles/profileService";
import * as profileRepo from "@/lib/profiles/profileRepository";
import * as settingsRepo from "@/lib/settings/settingsRepository";
import * as userRepo from "@/lib/auth/userRepository";

interface ValidatedInput {
    names: string[];
    avatars: (ProfileAvatar | null)[];
    settings: { autoplayNext: boolean; autoPreviewsEnabled: boolean; reduceData: boolean };
}

type ValidationResult = { ok: true; value: ValidatedInput } | { ok: false; code: OnboardingErrorCode };

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const validateInput = (input: OnboardingInput): ValidationResult => {
    if (!Array.isArray(input.profiles) || input.profiles.length === 0) return { ok: false, code: "empty" };
    if (input.profiles.length > MAX_PROFILES_PER_ACCOUNT) return { ok: false, code: "limit" };

    const names: string[] = [];
    const avatars: (ProfileAvatar | null)[] = [];
    const seenNames = new Set<string>();

    for (const raw of input.profiles) {
        const name = validateProfileName(typeof raw?.name === "string" ? raw.name : "");
        if (name === null) return { ok: false, code: "invalid_name" };

        const key = name.toLocaleLowerCase("pl");
        if (seenNames.has(key)) return { ok: false, code: "duplicate_name" };
        seenNames.add(key);

        const avatar = raw?.avatar ?? null;
        if (avatar !== null && !isProfileAvatar(avatar)) return { ok: false, code: "invalid_avatar" };

        names.push(name);
        avatars.push(avatar);
    }

    const settings = input.settings;
    if (!isBoolean(settings?.autoplayNext) || !isBoolean(settings?.autoPreviewsEnabled) || !isBoolean(settings?.reduceData)) {
        return { ok: false, code: "server" };
    }

    return {
        ok: true,
        value: {
            names,
            avatars,
            settings: {
                autoplayNext: settings.autoplayNext,
                autoPreviewsEnabled: settings.autoPreviewsEnabled,
                reduceData: settings.reduceData,
            },
        },
    };
};

export type CompleteOnboardingResult =
    | { ok: true; profiles: Profile[] }
    | { ok: false; code: OnboardingErrorCode };

export const completeOnboarding = async (
    userId: number,
    username: string,
    input: OnboardingInput,
): Promise<CompleteOnboardingResult> => {
    const validation = validateInput(input);
    if (!validation.ok) return { ok: false, code: validation.code };
    const { names, avatars, settings } = validation.value;

    try {
        const profiles = await withTransaction(async (connection) => {
            const defaultProfileId = await ensureDefaultProfile(userId, username, connection);

            await profileRepo.renameProfileById(defaultProfileId, names[0]!, connection);
            await profileRepo.updateProfileAvatarById(defaultProfileId, avatars[0]!, connection);

            for (let index = 1; index < names.length; index += 1) {
                await profileRepo.insertProfile(userId, names[index]!, avatars[index]!, connection);
            }

            await settingsRepo.upsertProfileSettings(defaultProfileId, {
                autoplay_next: settings.autoplayNext ? 1 : 0,
                auto_previews_enabled: settings.autoPreviewsEnabled ? 1 : 0,
                reduce_data: settings.reduceData ? 1 : 0,
            }, connection);

            await userRepo.markUserOnboarded(userId, connection);

            return profileRepo.listProfilesForUser(userId, connection);
        });

        return { ok: true, profiles };
    } catch (error) {
        if (error instanceof DatabaseError && error.code === "conflict") return { ok: false, code: "duplicate_name" };
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type SkipOnboardingResult = { ok: true } | { ok: false; code: "server" };

export const skipOnboarding = async (userId: number, username: string): Promise<SkipOnboardingResult> => {
    try {
        await ensureDefaultProfile(userId, username);
        await userRepo.markUserOnboarded(userId);
        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
