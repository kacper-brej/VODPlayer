"use server";
import { getSessionUser } from "@/lib/auth/session";
import { createProfile } from "@/lib/profiles/profileService";
import type { CreateProfileResponse } from "@/lib/core/contracts";
import { isProfileAvatar, type ProfileAvatar } from "@/lib/core/onboarding";

type CreateProfileError = {
    success: false;
    error: "unauthenticated" | "backend" | "network" | "invalid_response";
    message?: string;
};

const createProfileAction = async (
    name: string,
    avatar: ProfileAvatar | null = null,
): Promise<CreateProfileResponse | CreateProfileError> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };
    if (avatar !== null && !isProfileAvatar(avatar)) {
        return { success: false, error: "backend", message: "Wybierz prawidłowy awatar." };
    }

    const result = await createProfile(user.id, name, avatar);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Nazwa profilu musi mieć od 1 do 50 znaków.",
            limit: "Osiągnięto limit pięciu profili na koncie.",
            conflict: "Profil o tej nazwie już istnieje.",
            server: "Nie udało się utworzyć profilu.",
        };
        return { success: false, error: "backend", message: messages[result.code] };
    }

    return result.profile;
};

export default createProfileAction;
