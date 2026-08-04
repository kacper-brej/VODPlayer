import { redirect } from "next/navigation";
import SkipLink from "@/components/layout/SkipLink";
import { getCurrentUserAction } from "@/lib/authActions";

const WatchLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
    const user = await getCurrentUserAction();

    if (!user) redirect("/login");

    return (
        <>
            <SkipLink />
            <main id="main-content" tabIndex={-1} className="min-h-dvh bg-black outline-none">
                {children}
            </main>
        </>
    );
};

export default WatchLayout;
