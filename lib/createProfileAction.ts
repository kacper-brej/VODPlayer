"use server";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import {
    validateCreateProfileResponse,
    type CreateProfileResponse,
} from "@/lib/contracts";

type CreateProfileError = {
    success: false;
    error: "unauthenticated" | "backend" | "network" | "invalid_response";
};

const createProfileAction = async (
    name: string,
): Promise<CreateProfileResponse | CreateProfileError> => {
    const headers = await sessionHeaders();

    if (!headers) {
        console.error("createProfileAction: missing session cookie");
        return { success: false, error: "unauthenticated" };
    }

    try {
        const res = await fetch(`${VOD_ORIGIN}/profiles.php`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            cache: "no-store",
            body: JSON.stringify({ name }),
        });

        if (!res.ok) {
            console.error("profiles.php POST ->", res.status, await res.text());
            return { success: false, error: "backend" };
        }

        const payload: unknown = await res.json();
        const result = validateCreateProfileResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return { success: false, error: "invalid_response" };
        }

        return result.data;
    } catch (error) {
        console.error("createProfileAction failed", error);
        return { success: false, error: "network" };
    }
};

export default createProfileAction;
