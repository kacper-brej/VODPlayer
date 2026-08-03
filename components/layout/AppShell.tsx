"use client"
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import SearchBar from "@/components/layout/SearchBar";
import CommandPaletteResolver from "@/components/layout/CommandPaletteResolver";
import { useAuth } from "@/lib/AuthContext";
import { ContentSkeleton, DataErrorState } from "@/components/data/DataState";
import type { SearchIndexEntry } from "@/lib/searchIndex";
import type { DataResult } from "@/lib/dataResult";

const NO_CHROME_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/qr-confirm", "/profiles", "/watch"];
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/qr-confirm"];

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
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-accent outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
        >
            Zaloguj się ponownie
        </button>
    </div>
);

const AttributionFooter = () => (
    <p className="px-4 py-3 text-center text-xs text-muted sm:px-8">
        Metadane i grafika częściowo dostarczane przez{" "}
        <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
            TMDB
        </a>
        . Ten produkt korzysta z TMDB API, ale nie jest wspierany ani certyfikowany przez TMDB.
    </p>
);

const OfflineBanner = () => (
    <div
        role="status"
        className="sticky bottom-0 z-30 flex items-center justify-center gap-2 border-t border-border bg-surface-light px-4 py-2.5 text-sm text-foreground"
    >
        <WifiOff size={16} className="text-danger" aria-hidden="true" />
        Brak połączenia
    </div>
);

interface AppShellProps {
    children: React.ReactNode;
    searchIndexPromise: Promise<DataResult<SearchIndexEntry[]>>;
}

const SkipLink = () => (
    <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent focus:outline-2 focus:outline-offset-[3px] focus:outline-primary"
    >
        Przejdź do treści
    </a>
);

const AppShell = ({ children, searchIndexPromise }: AppShellProps) => {
    const pathname = usePathname();
    const router = useRouter();
    const { user, error, loading, refreshUser } = useAuth();
    const isOnline = useOnlineStatus();
    const [hadSession, setHadSession] = useState(Boolean(user));

    if (user && !hadSession) {
        setHadSession(true);
    }

    const isNoChrome = NO_CHROME_ROUTES.includes(pathname);
    const sessionExpiredMidWork = !loading && !user && error === "unauthorized" && hadSession;
    const pendingLoginRedirect = !loading && !user && error === "unauthorized" && !hadSession && !PUBLIC_ROUTES.includes(pathname);

    useEffect(() => {
        if (loading) return;
        if (error && error !== "unauthorized") return;
        if (sessionExpiredMidWork) return;
        if (!user && !PUBLIC_ROUTES.includes(pathname)) {
            router.replace("/login");
        }
    }, [error, loading, user, pathname, router, sessionExpiredMidWork]);

    if (isNoChrome) {
        return (
            <>
                <SkipLink />
                <main id="main-content" tabIndex={-1} className="min-h-dvh outline-none">
                    {children}
                </main>
            </>
        );
    }

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
                className="pointer-events-none fixed inset-0 z-0 opacity-[0.045] mix-blend-soft-light"
                style={{ backgroundImage: GRAIN_BACKGROUND, backgroundSize: "200px 200px" }}
            />

            <SkipLink />

            <div className="relative z-10 flex w-full">
                <Sidebar />
                <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden">
                    <header className="sticky top-0 z-40 flex h-[76px] w-full shrink-0 items-center justify-center border-b border-nx-border/70 bg-[color-mix(in_srgb,var(--nx-bg)_88%,transparent)] px-5 backdrop-blur-xl sm:px-8">
                        <div className="flex w-full max-w-[1440px] justify-center">
                            <SearchBar />
                        </div>
                    </header>
                    <main
                        id="main-content"
                        tabIndex={-1}
                        className="flex-1 min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))] outline-none lg:pb-0"
                    >
                        {mainContent}
                    </main>
                    <AttributionFooter />
                    {!isOnline && <OfflineBanner />}
                </div>
            </div>

            <Suspense fallback={null}>
                <CommandPaletteResolver searchIndexPromise={searchIndexPromise} />
            </Suspense>
        </div>
    );
};

export default AppShell;
