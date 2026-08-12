import { redirect } from "next/navigation";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { getCurrentUserAction } from "@/lib/auth/authActions";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
    const user = await getCurrentUserAction();

    if (!user) redirect("/login?returnTo=/welcome");
    if (user.onboardedAt !== null) redirect("/profiles");

    return <OnboardingWizard username={user.username} />;
}
