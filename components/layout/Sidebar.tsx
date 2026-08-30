"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import { Command } from "lucide-react";
import { ADMIN_QUICK_JUMP_ITEM, NAV_ITEMS } from "@/config/menu";
import ProfileMenu from "@/components/layout/ProfileMenu";
import { openCommandPalette } from "@/lib/search/commandPalette";
import { useAuth } from "@/lib/auth/AuthContext";

interface NavRailItemsProps {
    orientation: "vertical" | "horizontal";
}

const NavRailItems = ({ orientation }: NavRailItemsProps) => {
    const pathname = usePathname();
    const { user } = useAuth();
    const items = user?.role === "admin" ? [...NAV_ITEMS, ADMIN_QUICK_JUMP_ITEM] : NAV_ITEMS;
    const activeIndex = items.findIndex((item) =>
        item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
    const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

    const moveFocus = (nextIndex: number) => {
        linkRefs.current[nextIndex]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
        const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
        const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

        if (event.key === nextKey) {
            event.preventDefault();
            moveFocus((index + 1) % items.length);
        } else if (event.key === prevKey) {
            event.preventDefault();
            moveFocus((index - 1 + items.length) % items.length);
        } else if (event.key === "Home") {
            event.preventDefault();
            moveFocus(0);
        } else if (event.key === "End") {
            event.preventDefault();
            moveFocus(items.length - 1);
        }
    };

    return (
        <ul
            className={
                orientation === "vertical"
                    ? "flex flex-col items-stretch gap-1"
                    : "flex w-full flex-row items-stretch justify-between"
            }
        >
            {items.map(({ name, href, icon: Icon }, index) => {
                const isActive = index === activeIndex;

                return (
                    <li key={href} className={orientation === "horizontal" ? "flex-1" : undefined}>
                        <Link
                            ref={(node) => {
                                linkRefs.current[index] = node;
                            }}
                            href={href}
                            prefetch={orientation === "horizontal" ? true : null}
                            aria-current={isActive ? "page" : undefined}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={`relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary ${
                                isActive ? "text-foreground" : "text-muted hover:bg-surface-light hover:text-foreground"
                            }`}
                        >
                            {isActive && (
                                <span
                                    aria-hidden="true"
                                    className={
                                        orientation === "vertical"
                                            ? "absolute left-0 top-1/2 h-8 w-[2px] -translate-y-1/2 rounded-full bg-primary"
                                            : "absolute inset-x-3 top-0 h-[2px] rounded-full bg-primary"
                                    }
                                />
                            )}
                            <Icon size={20} strokeWidth={2} aria-hidden="true" />
                            <span className="font-ui text-[10px] leading-[1.2] lg:text-[9.5px] xl:text-[10px]">
                                {name}
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
};

const Sidebar = () => {
    return (
        <>
            <aside className="sticky top-0 z-[70] hidden h-dvh w-20 shrink-0 flex-col items-center justify-between border-r border-border bg-surface py-4 lg:flex xl:w-[92px]">
                <div className="flex w-full flex-col items-center gap-6">
                    <Link
                        href="/"
                        aria-label="Nocturna — strona główna"
                        className="flex size-11 items-center justify-center rounded-lg font-display text-[28px] text-foreground outline-none transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary"
                    >
                        N
                    </Link>

                    <nav aria-label="Główna nawigacja" className="w-full px-2">
                        <NavRailItems orientation="vertical" />
                    </nav>
                </div>

                <div className="flex w-full flex-col items-center gap-3 border-t border-border pt-4">
                    <button
                        type="button"
                        onClick={openCommandPalette}
                        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg px-2 py-2 text-muted outline-none transition-colors hover:bg-surface-light hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary"
                    >
                        <Command size={18} strokeWidth={2} aria-hidden="true" />
                        <span className="font-mono text-[9px] tracking-[0.14em] uppercase">Ctrl K</span>
                        <span className="sr-only">Otwórz wyszukiwanie</span>
                    </button>

                    <ProfileMenu />
                </div>
            </aside>

            <nav
                aria-label="Główna nawigacja mobilna"
                className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border lg:hidden"
                style={{
                    backgroundColor: "rgba(21,18,28,0.86)",
                    backdropFilter: "blur(26px)",
                    WebkitBackdropFilter: "blur(26px)",
                    height: "var(--nx-mobile-nav-h)",
                    paddingBottom: "env(safe-area-inset-bottom)",
                    paddingLeft: "max(8px, env(safe-area-inset-left))",
                    paddingRight: "max(8px, env(safe-area-inset-right))",
                }}
            >
                <NavRailItems orientation="horizontal" />
            </nav>
        </>
    );
};

export default Sidebar;
