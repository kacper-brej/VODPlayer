"use client"
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SearchBar from "@/components/SearchBar";

const NO_CHROME_ROUTES = ["/login", "/signup"];

const AppShell = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();

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
