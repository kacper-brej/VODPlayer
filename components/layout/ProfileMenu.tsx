"use client"
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUnreadNotificationsCountAction } from "@/lib/notificationsActions";

const initialsFrom = (username: string) => {
    const trimmed = username.trim();
    if (!trimmed) return "";

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (parts[0][0] + parts[1][0]).toUpperCase();
};

const ProfileMenu = () => {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!user) return;

        let active = true;

        getUnreadNotificationsCountAction().then((count) => {
            if (active) setUnreadCount(count);
        });

        return () => {
            active = false;
        };
    }, [user]);

    const displayedUnreadCount = user ? unreadCount : 0;

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setIsOpen(false);
            triggerRef.current?.focus();
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const handleLogout = async () => {
        setIsOpen(false);
        await logout();
        router.push("/login");
    };

    const initials = user ? initialsFrom(user.username) : "";

    return (
        <div ref={containerRef} className="relative z-[80]">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className="relative flex size-11 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-light text-foreground outline-none hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
            >
                {initials ? (
                    <span className="font-mono text-[11px] text-foreground">{initials}</span>
                ) : (
                    <User size={16} className="text-muted" aria-hidden="true" />
                )}
                {displayedUnreadCount > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-danger ring-2 ring-surface"
                    />
                )}
                <span className="sr-only">
                    Menu profilu{displayedUnreadCount > 0 ? ` — ${displayedUnreadCount} nieprzeczytanych powiadomień` : ""}
                </span>
            </button>

            {isOpen && (
                <div
                    role="menu"
                    aria-label="Menu profilu"
                    className="absolute bottom-0 left-full z-[90] ml-3 flex min-w-48 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-[0_16px_50px_rgba(0,0,0,.72)]"
                    style={{ backgroundColor: "rgba(12,10,17,0.96)", backdropFilter: "blur(22px)" }}
                >
                    <Link
                        role="menuitem"
                        href="/settings"
                        onClick={() => setIsOpen(false)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                    >
                        <Settings size={16} aria-hidden="true" />
                        Ustawienia
                    </Link>
                    <button
                        role="menuitem"
                        type="button"
                        onClick={handleLogout}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger outline-none transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                    >
                        <LogOut size={16} aria-hidden="true" />
                        Wyloguj
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfileMenu;
