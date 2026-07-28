"use client"
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import SearchBar from "@/components/layout/SearchBar";
import { useAuth } from "@/lib/AuthContext";
import { DataErrorState } from "@/components/data/DataState";

const NO_CHROME_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/qr-confirm", "/profiles"];
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/qr-confirm"];
const AUTH_ONLY_ROUTES = ["/login", "/signup"];

const AppShell = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { user, error, loading, refreshUser } = useAuth();

    useEffect(() => {
        if (loading) return;
        if (error && error !== "unauthorized") return;
        if (!user && !PUBLIC_ROUTES.includes(pathname)) {
            router.replace("/login");
        } else if (user && AUTH_ONLY_ROUTES.includes(pathname)) {
            router.replace("/profiles");
        }
    }, [error, loading, user, pathname, router]);

    if (loading) {
        return (
            <div className="min-h-dvh w-full flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (error && error !== "unauthorized") {
        return (
            <div className="min-h-dvh w-full bg-background p-4 flex items-center justify-center">
                <DataErrorState reason={error} onRetry={refreshUser} />
            </div>
        );
    }

    if (!user && !PUBLIC_ROUTES.includes(pathname)) {
        return null;
    }

    if (user && AUTH_ONLY_ROUTES.includes(pathname)) {
        return null;
    }

    if (NO_CHROME_ROUTES.includes(pathname)) {
        return <>{children}</>;
    }

    return (
        <div className="flex w-full">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-dvh min-w-0 overflow-x-hidden">
                <header className="sticky top-0 z-40 w-full pt-4 sm:pt-8 px-4 sm:pl-16 sm:pr-8 flex justify-start items-center shrink-0">
                    <SearchBar />
                </header>
                <main className="flex-1 min-h-dvh">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AppShell;
