"use server";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import {
    validateRenameProfileResponse,
    type RenameProfileResponse,
} from "@/lib/contracts";

type RenameProfileError = {
    success: false;
    error: "unauthenticated" | "backend" | "network" | "invalid_response";
};

const renameProfileAction = async (
    id: number,
    name: string,
): Promise<RenameProfileResponse | RenameProfileError> => {
    const headers = await sessionHeaders();

    if (!headers) {
        console.error("renameProfileAction: missing session cookie");
        return { success: false, error: "unauthenticated" };
    }

    try {
        const res = await fetch(`${VOD_ORIGIN}/profiles.php?id=${encodeURIComponent(String(id))}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            cache: "no-store",
            body: JSON.stringify({ name }),
        });

        if (!res.ok) {
            console.error("profiles.php PATCH ->", res.status, await res.text());
            return { success: false, error: "backend" };
        }

        const payload: unknown = await res.json();
        const result = validateRenameProfileResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return { success: false, error: "invalid_response" };
        }

        return result.data;
    } catch (error) {
        console.error("renameProfileAction failed", error);
        return { success: false, error: "network" };
    }
};

export default renameProfileAction;
