import { cache } from "react";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import {
    validateProfilesResponse,
    type Profile,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

export type { Profile };

const loadProfiles = async (): Promise<DataResult<Profile[]>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const res = await fetch(`${VOD_ORIGIN}/profiles.php`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("profiles.php GET ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateProfilesResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return result.data.profiles.length === 0
            ? dataEmpty(result.data.profiles)
            : dataSuccess(result.data.profiles);
    } catch (error) {
        console.error("Profiles request failed:", error);
        return dataFailure("network");
    }
};

export const getProfiles = cache(loadProfiles);
