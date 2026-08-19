"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import { FolderOpen, HardDrive, HardDriveDownload, LayoutDashboard, ListVideo, ShieldCheck, UploadCloud, Users } from "lucide-react";

const ADMIN_ITEMS = [
    { label: "Przegląd", href: "/admin", icon: LayoutDashboard },
    { label: "Biblioteka", href: "/admin/library", icon: FolderOpen },
    { label: "Pliki na serwerze", href: "/admin/library-scan", icon: HardDriveDownload },
    { label: "Rozdziały", href: "/admin/chapters", icon: ListVideo },
    { label: "Magazyn B2", href: "/admin/storage", icon: HardDrive },
    { label: "Wyślij plik", href: "/admin/upload", icon: UploadCloud },
    { label: "Konta", href: "/admin/users", icon: Users },
] as const;

const AdminSectionNav = () => {
    const pathname = usePathname();
    const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

    const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
        let nextIndex: number | null = null;

        if (event.key === "ArrowRight") nextIndex = (index + 1) % ADMIN_ITEMS.length;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + ADMIN_ITEMS.length) % ADMIN_ITEMS.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = ADMIN_ITEMS.length - 1;

        if (nextIndex === null) return;

        event.preventDefault();
        linkRefs.current[nextIndex]?.focus();
    };

    return (
        <header>
            <div className="flex items-center gap-3">
                <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-[var(--r-s)] border border-nx-border bg-nx-panel text-nx-accent shadow-[var(--sh-1)]"
                >
                    <ShieldCheck size={20} />
                </span>
                <div>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-accent">
                        Strefa operatora
                    </p>
                    <p className="mt-1 font-display text-[30px] leading-none tracking-[-0.025em] text-nx-text">
                        Administracja
                    </p>
                </div>
            </div>

            <div className="mt-6 overflow-x-auto">
                <nav
                    aria-label="Panel administracyjny"
                    className="flex min-w-max gap-2 border-b border-nx-border pb-3"
                >
                    {ADMIN_ITEMS.map(({ label, href, icon: Icon }, index) => {
                        const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));

                        return (
                            <Link
                                key={href}
                                ref={(node) => {
                                    linkRefs.current[index] = node;
                                }}
                                href={href}
                                aria-current={isActive ? "page" : undefined}
                                onKeyDown={(event) => handleKeyDown(event, index)}
                                className={`relative flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--r-s)] px-4 text-sm font-medium outline-none transition-[background-color,color,opacity] duration-[var(--dur-fast)] ease-[var(--ease)] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent ${
                                    isActive
                                        ? "bg-nx-raised text-nx-text opacity-100"
                                        : "text-nx-text-2 opacity-80 hover:bg-nx-raised hover:text-nx-text hover:opacity-100"
                                }`}
                            >
                                <Icon size={16} aria-hidden="true" />
                                <span>{label}</span>
                                {isActive && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute -bottom-[13px] left-4 right-4 h-0.5 rounded-full bg-nx-accent"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
};

export default AdminSectionNav;
