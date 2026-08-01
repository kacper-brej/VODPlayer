"use server";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import { validateRequestEmailChangeResponse } from "@/lib/contracts";

type RequestEmailChangeResult =
    | { success: true; message: string }
    | { success: false; error: "unauthenticated" | "backend" | "network" | "invalid_response"; message?: string };

const requestEmailChangeAction = async (
    email: string,
): Promise<RequestEmailChangeResult> => {
    const headers = await sessionHeaders();

    if (!headers) {
        console.error("requestEmailChangeAction: missing session cookie");
        return { success: false, error: "unauthenticated" };
    }

    try {
        const res = await fetch(`${VOD_ORIGIN}/change-email.php`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            cache: "no-store",
            body: JSON.stringify({ email }),
        });

        const payload: unknown = await res.json().catch(() => null);

        if (!res.ok) {
            const message = payload && typeof payload === "object" && "error" in payload
                && typeof (payload as { error: unknown }).error === "string"
                ? (payload as { error: string }).error
                : undefined;
            console.error("change-email.php ->", res.status, message);
            return { success: false, error: "backend", message };
        }

        const result = validateRequestEmailChangeResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return { success: false, error: "invalid_response" };
        }

        return { success: true, message: result.data.message };
    } catch (error) {
        console.error("requestEmailChangeAction failed", error);
        return { success: false, error: "network" };
    }
};

export default requestEmailChangeAction;
