import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getCurrentUserAction } from "@/lib/auth/authActions";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { getSettings } from "@/lib/settings/settings";
import { PreviewPreferencesProvider } from "@/components/preview/PreviewPreferences";

export const dynamic = "force-dynamic";

const AppLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
    const user = await getCurrentUserAction();

    if (!user) redirect("/login");
    if (user.onboardedAt === null) redirect("/welcome");
    const settingsResult = await getSettings();
    if (settingsResult.kind === "error") throw new Error("Failed to load profile settings.");
    const settings = settingsResult.data;

    return (
        <AuthProvider initialUser={user}>
            <PreviewPreferencesProvider
                autoPreviewsEnabled={settings.autoPreviewsEnabled}
                reduceData={settings.reduceData}
            >
                <AppShell>{children}</AppShell>
            </PreviewPreferencesProvider>
        </AuthProvider>
    );
};

export default AppLayout;
