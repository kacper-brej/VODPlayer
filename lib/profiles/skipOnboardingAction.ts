"use server";
import { getSessionUser } from "@/lib/auth/session";
import { skipOnboarding } from "@/lib/profiles/onboardingService";

type SkipOnboardingActionResult =
    | { success: true }
    | { success: false; error: "unauthenticated" | "backend" };

const skipOnboardingAction = async (): Promise<SkipOnboardingActionResult> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };

    const result = await skipOnboarding(user.id, user.username);
    if (!result.ok) return { success: false, error: "backend" };

    return { success: true };
};

export default skipOnboardingAction;
