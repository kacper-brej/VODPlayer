import { redirect } from "next/navigation";
import SkipLink from "@/components/layout/SkipLink";
import { getCurrentUserAction } from "@/lib/authActions";

const ProfilesLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
    const user = await getCurrentUserAction();

    if (!user) redirect("/login");

    return (
        <>
            <SkipLink />
            <main id="main-content" tabIndex={-1} className="min-h-dvh outline-none">
                {children}
            </main>
        </>
    );
};

export default ProfilesLayout;
