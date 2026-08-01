"use server";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateSettingsResponse,
    type ProfileSettings,
} from "@/lib/contracts";

export interface UpdateSettingsInput {
    autoplayNext?: boolean;
    skipIntroPrompt?: boolean;
    preferredSubtitleLang?: string | null;
    preferredAudioLang?: string | null;
    defaultVolume?: number;
    reduceData?: boolean;
}

type UpdateSettingsResult =
    | { success: true; settings: ProfileSettings }
    | { success: false; error: "unauthenticated" | "backend" | "network" | "invalid_response"; message?: string };

const updateSettingsAction = async (
    input: UpdateSettingsInput,
): Promise<UpdateSettingsResult> => {
    const headers = await sessionHeaders();

    if (!headers) {
        console.error("updateSettingsAction: missing session cookie");
        return { success: false, error: "unauthenticated" };
    }

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
        const res = await fetch(`${VOD_ORIGIN}/settings.php${profileParam}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            cache: "no-store",
            body: JSON.stringify(input),
        });

        const payload: unknown = await res.json().catch(() => null);

        if (!res.ok) {
            const message = payload && typeof payload === "object" && "error" in payload
                && typeof (payload as { error: unknown }).error === "string"
                ? (payload as { error: string }).error
                : undefined;
            console.error("settings.php PATCH ->", res.status, message);
            return { success: false, error: "backend", message };
        }

        const result = validateSettingsResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return { success: false, error: "invalid_response" };
        }

        return { success: true, settings: result.data.settings };
    } catch (error) {
        console.error("updateSettingsAction failed", error);
        return { success: false, error: "network" };
    }
};

export default updateSettingsAction;
