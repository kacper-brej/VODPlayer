export const MAX_PROFILES_PER_ACCOUNT = 5;

export const PROFILE_AVATARS = [
    "nx-01", "nx-02", "nx-03", "nx-04", "nx-05", "nx-06", "nx-07", "nx-08",
] as const;

export type ProfileAvatar = (typeof PROFILE_AVATARS)[number];

export const isProfileAvatar = (value: unknown): value is ProfileAvatar =>
    typeof value === "string" && (PROFILE_AVATARS as readonly string[]).includes(value);

export interface OnboardingProfileInput {
    name: string;
    avatar: ProfileAvatar | null;
}

export interface OnboardingSettingsInput {
    autoplayNext: boolean;
    autoPreviewsEnabled: boolean;
    reduceData: boolean;
}

export interface OnboardingInput {
    profiles: OnboardingProfileInput[];
    settings: OnboardingSettingsInput;
}

export type OnboardingErrorCode =
    | "empty"
    | "invalid_name"
    | "duplicate_name"
    | "limit"
    | "invalid_avatar"
    | "server";
