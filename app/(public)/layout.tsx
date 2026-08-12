import SkipLink from "@/components/layout/SkipLink";
import { AuthProvider } from "@/lib/auth/AuthContext";

const PublicLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
    <AuthProvider initialUser={null}>
        <SkipLink />
        <main id="main-content" tabIndex={-1} className="min-h-dvh outline-none">
            {children}
        </main>
    </AuthProvider>
);

export default PublicLayout;
