"use server";
import { getSessionUser } from "@/lib/auth/session";
import { renameProfile } from "@/lib/profiles/profileService";
import type { RenameProfileResponse } from "@/lib/core/contracts";

type RenameProfileError = {
    success: false;
    error: "unauthenticated" | "backend" | "network" | "invalid_response";
    message?: string;
};

const renameProfileAction = async (id: number, name: string): Promise<RenameProfileResponse | RenameProfileError> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };

    const result = await renameProfile(user.id, id, name);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Nazwa profilu musi mieć od 1 do 50 znaków.",
            forbidden: "Profil nie należy do tego konta.",
            conflict: "Profil o tej nazwie już istnieje.",
            server: "Nie udało się zmienić nazwy profilu.",
        };
        return { success: false, error: "backend", message: messages[result.code] };
    }

    return result.profile;
};

export default renameProfileAction;
