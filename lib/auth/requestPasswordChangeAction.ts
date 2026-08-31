"use server";
import { getSessionUser } from "@/lib/auth/session";
import { requestPasswordReset } from "@/lib/auth/accountService";
import { isPublicDemoAccount } from "@/lib/auth/publicDemoAccount";

type RequestPasswordChangeResult =
    | { success: true }
    | { success: false; error: "unauthenticated" | "backend" | "network" };

const requestPasswordChangeAction = async (): Promise<RequestPasswordChangeResult> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };
    if (isPublicDemoAccount(user)) return { success: false, error: "backend" };

    const result = await requestPasswordReset(user.email);
    if (!result.ok) return { success: false, error: "backend" };

    return { success: true };
};

export default requestPasswordChangeAction;
