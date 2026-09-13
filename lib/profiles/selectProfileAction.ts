"use server";
import { cookies } from "next/headers";
import { PROFILE_COOKIE } from "@/lib/core/vodConfig";
import { getProfiles } from "@/lib/profiles/profiles";
import { getSessionUser } from "@/lib/auth/session";

const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type SelectProfileResult =
    | { success: true }
    | { success: false; error: "unauthorized" | "not_found" | "backend" };

const selectProfileAction = async (profileId: number): Promise<SelectProfileResult> => {
    if (!await getSessionUser()) return { success: false, error: "unauthorized" };
    if (!Number.isSafeInteger(profileId) || profileId <= 0) return { success: false, error: "not_found" };
    const result = await getProfiles();

    if (result.kind === "error") {
        return { success: false, error: result.reason === "unauthorized" ? "unauthorized" : "backend" };
    }

    if (!result.data.some((profile) => profile.id === profileId)) {
        return { success: false, error: "not_found" };
    }

    (await cookies()).set(PROFILE_COOKIE, String(profileId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: PROFILE_COOKIE_MAX_AGE,
    });
    return { success: true };
};

export default selectProfileAction;
