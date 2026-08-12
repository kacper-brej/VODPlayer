import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getSettings as getSettingsFromService, DEFAULT_PROFILE_SETTINGS } from "@/lib/settings/settingsService";
import type { ProfileSettings } from "@/lib/core/contracts";
import {
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";

export type { ProfileSettings };
export { DEFAULT_PROFILE_SETTINGS };

const loadSettings = async (): Promise<DataResult<ProfileSettings>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    try {
        const settings = await getSettingsFromService(user.id, user.username);
        return dataSuccess(settings);
    } catch (error) {
        console.error("getSettings failed:", error);
        return dataFailure("server");
    }
};

export const getSettings = cache(loadSettings);
