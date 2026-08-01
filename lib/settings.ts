import { cache } from "react";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateSettingsResponse,
    type ProfileSettings,
} from "@/lib/contracts";
import {
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

export type { ProfileSettings };

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
    autoplayNext: true,
    skipIntroPrompt: true,
    preferredSubtitleLang: null,
    preferredAudioLang: null,
    defaultVolume: 100,
    reduceData: false,
};

const loadSettings = async (): Promise<DataResult<ProfileSettings>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
        const res = await fetch(`${VOD_ORIGIN}/settings.php${profileParam}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("settings.php GET ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateSettingsResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data.settings);
    } catch (error) {
        console.error("Settings request failed:", error);
        return dataFailure("network");
    }
};

export const getSettings = cache(loadSettings);
