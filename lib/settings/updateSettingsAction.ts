"use server";
import { getSessionUser } from "@/lib/auth/session";
import { updateSettings, type UpdateSettingsInput } from "@/lib/settings/settingsService";
import type { ProfileSettings } from "@/lib/core/contracts";

export type { UpdateSettingsInput };

type UpdateSettingsResult =
    | { success: true; settings: ProfileSettings }
    | { success: false; error: "unauthenticated" | "backend" | "network" | "invalid_response"; message?: string };

const updateSettingsAction = async (
    input: UpdateSettingsInput,
): Promise<UpdateSettingsResult> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };

    const result = await updateSettings(user.id, user.username, input);
    if (!result.ok) return { success: false, error: "invalid_response" };

    return { success: true, settings: result.settings };
};

export default updateSettingsAction;
