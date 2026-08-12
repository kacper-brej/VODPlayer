"use server";
import { getSessionUser } from "@/lib/auth/session";
import { requestPasswordReset } from "@/lib/auth/accountService";

type RequestPasswordChangeResult =
    | { success: true }
    | { success: false; error: "unauthenticated" | "backend" | "network" };

const requestPasswordChangeAction = async (): Promise<RequestPasswordChangeResult> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };

    const result = await requestPasswordReset(user.email);
    if (!result.ok) return { success: false, error: "backend" };

    return { success: true };
};

export default requestPasswordChangeAction;
