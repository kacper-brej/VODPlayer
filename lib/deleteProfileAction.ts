"use server";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import {
    validateDeleteProfileResponse,
    type DeleteProfileResponse,
} from "@/lib/contracts";

type DeleteProfileError = {
    success: false;
    error: "unauthenticated" | "backend" | "network" | "invalid_response";
};

const deleteProfileAction = async (
    id: number,
): Promise<DeleteProfileResponse | DeleteProfileError> => {
    const headers = await sessionHeaders();

    if (!headers) {
        console.error("deleteProfileAction: missing session cookie");
        return { success: false, error: "unauthenticated" };
    }

    try {
        const res = await fetch(`${VOD_ORIGIN}/profiles.php?id=${encodeURIComponent(String(id))}`, {
            method: "DELETE",
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("profiles.php DELETE ->", res.status, await res.text());
            return { success: false, error: "backend" };
        }

        const payload: unknown = await res.json();
        const result = validateDeleteProfileResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return { success: false, error: "invalid_response" };
        }

        return result.data;
    } catch (error) {
        console.error("deleteProfileAction failed", error);
        return { success: false, error: "network" };
    }
};

export default deleteProfileAction;
