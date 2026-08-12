"use server";
import { getSessionUser } from "@/lib/auth/session";
import { completeOnboarding } from "@/lib/profiles/onboardingService";
import type { OnboardingInput, OnboardingErrorCode } from "@/lib/core/onboarding";
import type { Profile } from "@/lib/core/contracts";

export type { OnboardingInput };

type CompleteOnboardingActionResult =
    | { success: true; profiles: Profile[] }
    | { success: false; error: "unauthenticated" | "backend"; code?: OnboardingErrorCode; message?: string };

const ERROR_MESSAGES: Record<OnboardingErrorCode, string> = {
    empty: "Dodaj przynajmniej jeden profil.",
    invalid_name: "Nazwa profilu musi mieć od 1 do 50 znaków.",
    duplicate_name: "Profile muszą mieć różne nazwy.",
    limit: "Maksymalnie pięć profili na koncie.",
    invalid_avatar: "Wybrany awatar jest niedostępny.",
    server: "Nie udało się zapisać ustawień.",
};

const completeOnboardingAction = async (input: OnboardingInput): Promise<CompleteOnboardingActionResult> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };

    const result = await completeOnboarding(user.id, user.username, input);
    if (!result.ok) {
        return { success: false, error: "backend", code: result.code, message: ERROR_MESSAGES[result.code] };
    }

    return { success: true, profiles: result.profiles };
};

export default completeOnboardingAction;
