"use server";

import { getSessionUser } from "@/lib/auth/session";
import type { ProfileAvatar } from "@/lib/core/onboarding";
import { updateProfile } from "@/lib/profiles/profileService";

type UpdateProfileResponse =
    | { success: true; profile: { id: number; name: string; avatar: ProfileAvatar | null } }
    | { success: false; error: "unauthenticated" | "backend"; message: string };

const updateProfileAction = async (
    id: number,
    name: string,
    avatar: ProfileAvatar | null,
): Promise<UpdateProfileResponse> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated", message: "Sesja wygasła. Zaloguj się ponownie." };

    const result = await updateProfile(user.id, id, name, avatar);
    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Nazwa profilu musi mieć od 1 do 50 znaków.",
            invalid_avatar: "Wybierz prawidłowy awatar.",
            forbidden: "Profil nie należy do tego konta.",
            conflict: "Profil o tej nazwie już istnieje.",
            server: "Nie udało się zaktualizować profilu.",
        };
        return { success: false, error: "backend", message: messages[result.code] };
    }

    return { success: true, profile: result.profile };
};

export default updateProfileAction;
