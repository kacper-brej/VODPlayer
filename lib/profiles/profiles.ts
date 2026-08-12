import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/profileService";
import { type Profile } from "@/lib/core/contracts";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

export type { Profile };

const loadProfiles = async (): Promise<DataResult<Profile[]>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    try {
        const profiles = await listProfiles(user.id, user.username);
        return profiles.length === 0 ? dataEmpty(profiles) : dataSuccess(profiles);
    } catch (error) {
        console.error("listProfiles failed:", error);
        return dataFailure("server");
    }
};

export const getProfiles = cache(loadProfiles);
