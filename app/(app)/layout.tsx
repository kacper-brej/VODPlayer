import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getCurrentUserAction } from "@/lib/authActions";
import { AuthProvider } from "@/lib/AuthContext";

const AppLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
    const user = await getCurrentUserAction();

    if (!user) redirect("/login");

    return (
        <AuthProvider initialUser={user}>
            <AppShell>{children}</AppShell>
        </AuthProvider>
    );
};

export default AppLayout;
