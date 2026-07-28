"use server";
import { cookies } from "next/headers";
import { PROFILE_COOKIE } from "@/lib/vodConfig";

const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const selectProfileAction = async (profileId: number): Promise<void> => {
    (await cookies()).set(PROFILE_COOKIE, String(profileId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: PROFILE_COOKIE_MAX_AGE,
    });
};

export default selectProfileAction;
