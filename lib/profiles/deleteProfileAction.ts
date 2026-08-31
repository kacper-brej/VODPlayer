"use server";
import { getSessionUser } from "@/lib/auth/session";
import { deleteProfile } from "@/lib/profiles/profileService";
import type { DeleteProfileResponse } from "@/lib/core/contracts";
import { PUBLIC_DEMO_LOCKED_MESSAGE, isPublicDemoAccount } from "@/lib/auth/publicDemoAccount";

type DeleteProfileError = {
    success: false;
    error: "unauthenticated" | "backend" | "network" | "invalid_response";
    message?: string;
};

const deleteProfileAction = async (id: number): Promise<DeleteProfileResponse | DeleteProfileError> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };
    if (isPublicDemoAccount(user)) {
        return { success: false, error: "backend", message: PUBLIC_DEMO_LOCKED_MESSAGE };
    }

    const result = await deleteProfile(user.id, id);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            forbidden: "Profil nie należy do tego konta.",
            last_profile: "Nie można usunąć jedynego profilu na koncie.",
            server: "Nie udało się usunąć profilu.",
        };
        return { success: false, error: "backend", message: messages[result.code] };
    }

    return { success: true };
};

export default deleteProfileAction;
