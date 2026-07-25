"use client"
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import SearchBar from "@/components/layout/SearchBar";
import { useAuth } from "@/lib/AuthContext";

const NO_CHROME_ROUTES = ["/login", "/signup"];
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/qr-confirm"];
const AUTH_ONLY_ROUTES = ["/login", "/signup"];

const AppShell = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        if (!user && !PUBLIC_ROUTES.includes(pathname)) {
            router.replace("/login");
        } else if (user && AUTH_ONLY_ROUTES.includes(pathname)) {
            router.replace("/");
        }
    }, [loading, user, pathname, router]);

    if (loading) {
        return (
            <div className="min-h-dvh w-full flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
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
            <div className="hidden md:block w-28 shrink-0" />
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-dvh min-w-0 overflow-x-hidden">
                <header className="sticky top-0 z-40 w-full pt-4 md:pt-8 px-4 md:px-8 flex justify-start items-center shrink-0">
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