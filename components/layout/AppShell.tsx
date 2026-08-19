"use client"
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TmdbLogo from "@/components/layout/TmdbLogo";
import SearchBar from "@/components/layout/SearchBar";
import ProfileMenu from "@/components/layout/ProfileMenu";
import CommandPaletteLauncher from "@/components/layout/CommandPaletteLauncher";
import { useAuth } from "@/lib/auth/AuthContext";
import { ContentSkeleton, DataErrorState } from "@/components/data/DataState";

const GRAIN_BACKGROUND = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        queueMicrotask(() => setIsOnline(navigator.onLine));
        window.addEventListener("online", goOnline);
        window.addEventListener("offline", goOffline);
        return () => {
            window.removeEventListener("online", goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);

    return isOnline;
};

const SessionExpiredBanner = ({ onSignIn }: { onSignIn: () => void }) => (
    <div
        role="alert"
        className="mx-4 mt-4 flex flex-col gap-3 rounded-xl border border-danger/40 bg-surface px-5 py-4 sm:mx-8 sm:flex-row sm:items-center sm:justify-between"
    >
        <p className="text-sm text-foreground">Twoja sesja wygasła. Zaloguj się ponownie, aby kontynuować.</p>
        <button
            type="button"
            onClick={onSignIn}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-accent outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary"
        >
            Zaloguj się ponownie
        </button>
    </div>
);

const AttributionFooter = () => (
    <footer className="flex flex-col items-center justify-center gap-x-2.5 gap-y-1 px-4 py-3 text-center text-[10px] leading-[1.45] text-muted/70 sm:flex-row sm:px-8">
        <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-sm opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
        >
            <TmdbLogo className="h-2 w-auto" />
        </a>
        <p className="max-w-[52ch] text-balance">
            Ten produkt korzysta z API TMDB, ale nie jest zatwierdzony ani certyfikowany przez TMDB.
        </p>
    </footer>
);

const OfflineBanner = () => (
    <div
        role="status"
        className="sticky bottom-[var(--nx-mobile-nav-h)] z-30 flex items-center justify-center gap-2 border-t border-border bg-surface-light px-4 py-2.5 text-sm text-foreground"
    >
        <WifiOff size={16} className="text-danger" aria-hidden="true" />
        Brak połączenia
    </div>
);

interface AppShellProps {
    children: React.ReactNode;
}

const SkipLink = () => (
    <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent focus:outline-2 focus:outline-offset-3 focus:outline-primary"
    >
        Przejdź do treści
    </a>
);

const AppShell = ({ children }: AppShellProps) => {
    const router = useRouter();
    const { user, error, loading, refreshUser } = useAuth();
    const isOnline = useOnlineStatus();

    const sessionExpiredMidWork = !loading && !user && error === "unauthorized";
    const pendingLoginRedirect = !loading && !user && !sessionExpiredMidWork && (!error || error === "unauthorized");

    useEffect(() => {
        if (loading) return;
        if (error && error !== "unauthorized") return;
        if (sessionExpiredMidWork) return;
        if (!user) router.replace("/login");
    }, [error, loading, user, router, sessionExpiredMidWork]);

    let mainContent: React.ReactNode;

    if (loading || pendingLoginRedirect) {
        mainContent = <ContentSkeleton />;
    } else if (error && error !== "unauthorized") {
        mainContent = (
            <div className="flex min-h-[60vh] w-full items-center justify-center px-4 py-10 sm:px-8">
                <DataErrorState reason={error} onRetry={refreshUser} headingLevel={1} />
            </div>
        );
    } else {
        mainContent = (
            <>
                {sessionExpiredMidWork && <SessionExpiredBanner onSignIn={() => router.push("/login")} />}
                {children}
            </>
        );
    }

    return (
        <div className="relative flex w-full">
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-0 hidden opacity-[0.045] mix-blend-soft-light motion-reduce:hidden sm:block"
                style={{ backgroundImage: GRAIN_BACKGROUND, backgroundSize: "200px 200px" }}
            />

            <SkipLink />

            <div className="relative z-10 flex w-full">
                <Sidebar />
                <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden">
                    <header className="sticky top-0 z-40 flex h-[var(--nx-header-offset)] w-full shrink-0 items-center justify-center border-b border-nx-border/70 bg-[color-mix(in_srgb,var(--nx-bg)_94%,transparent)] px-4 pt-[env(safe-area-inset-top)] backdrop-blur-none sm:bg-[color-mix(in_srgb,var(--nx-bg)_88%,transparent)] sm:px-8 sm:backdrop-blur-xl">
                        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
                            <Link
                                href="/"
                                aria-label="Nocturna — strona główna"
                                className="flex size-10 shrink-0 items-center justify-center rounded-lg font-display text-[26px] text-foreground outline-none transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary lg:hidden"
                            >
                                N
                            </Link>

                            <div className="flex min-w-0 flex-1 justify-end sm:justify-center">
                                <SearchBar />
                            </div>

                            <div className="shrink-0 lg:hidden">
                                <ProfileMenu placement="header" />
                            </div>
                        </div>
                    </header>
                    <main
                        id="main-content"
                        tabIndex={-1}
                        className="flex-1 outline-none"
                    >
                        {mainContent}
                    </main>
                    <AttributionFooter />
                    {!isOnline && <OfflineBanner />}
                    <div aria-hidden="true" className="h-[var(--nx-mobile-nav-h)] shrink-0" />
                </div>
            </div>

            <CommandPaletteLauncher />
        </div>
    );
};

export default AppShell;
