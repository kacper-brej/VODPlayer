"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { Command } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { NAV_ITEMS } from "@/config/menu";
import ProfileMenu from "@/components/layout/ProfileMenu";
import { openCommandPalette } from "@/lib/commandPalette";

interface NavRailItemsProps {
    orientation: "vertical" | "horizontal";
    layoutId: string;
}

const NavRailItems = ({ orientation, layoutId }: NavRailItemsProps) => {
    const pathname = usePathname();
    const prefersReducedMotion = useReducedMotion();
    const activeIndex = NAV_ITEMS.findIndex((item) => item.href === pathname);

    const [lastPathname, setLastPathname] = useState(pathname);
    const [rovingIndex, setRovingIndex] = useState(activeIndex >= 0 ? activeIndex : 0);
    const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

    if (pathname !== lastPathname) {
        setLastPathname(pathname);
        if (activeIndex >= 0) setRovingIndex(activeIndex);
    }

    const moveFocus = (nextIndex: number) => {
        setRovingIndex(nextIndex);
        linkRefs.current[nextIndex]?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
        const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
        const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

        if (event.key === nextKey) {
            event.preventDefault();
            moveFocus((index + 1) % NAV_ITEMS.length);
        } else if (event.key === prevKey) {
            event.preventDefault();
            moveFocus((index - 1 + NAV_ITEMS.length) % NAV_ITEMS.length);
        } else if (event.key === "Home") {
            event.preventDefault();
            moveFocus(0);
        } else if (event.key === "End") {
            event.preventDefault();
            moveFocus(NAV_ITEMS.length - 1);
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
            {NAV_ITEMS.map(({ name, href, icon: Icon }, index) => {
                const isActive = index === activeIndex;

                return (
                    <li key={href} className={orientation === "horizontal" ? "flex-1" : undefined}>
                        <Link
                            ref={(node) => {
                                linkRefs.current[index] = node;
                            }}
                            href={href}
                            aria-current={isActive ? "page" : undefined}
                            tabIndex={index === rovingIndex ? 0 : -1}
                            onFocus={() => setRovingIndex(index)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={`relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary ${
                                isActive ? "text-foreground" : "text-muted hover:bg-surface-light hover:text-foreground"
                            }`}
                        >
                            {isActive && (
                                <motion.span
                                    layoutId={layoutId}
                                    aria-hidden="true"
                                    className="absolute left-0 top-1/2 h-8 w-[2px] -translate-y-1/2 rounded-full bg-primary"
                                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.2, 0.8, 0.25, 1] }}
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
            <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center justify-between border-r border-border bg-surface py-4 lg:flex xl:w-[92px]">
                <div className="flex w-full flex-col items-center gap-6">
                    <Link
                        href="/"
                        aria-label="Nocturna — strona główna"
                        className="flex size-11 items-center justify-center rounded-lg font-display text-[28px] text-foreground outline-none transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                    >
                        N
                    </Link>

                    <nav aria-label="Główna nawigacja" className="w-full px-2">
                        <NavRailItems orientation="vertical" layoutId="nav-rail-indicator-desktop" />
                    </nav>
                </div>

                <div className="flex w-full flex-col items-center gap-3 border-t border-border pt-4">
                    <button
                        type="button"
                        onClick={openCommandPalette}
                        className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-muted outline-none transition-colors hover:bg-surface-light hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
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
                className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border px-2 lg:hidden"
                style={{
                    backgroundColor: "rgba(21,18,28,0.86)",
                    backdropFilter: "blur(26px)",
                    WebkitBackdropFilter: "blur(26px)",
                    height: "calc(64px + env(safe-area-inset-bottom))",
                    paddingBottom: "env(safe-area-inset-bottom)",
                }}
            >
                <NavRailItems orientation="horizontal" layoutId="nav-rail-indicator-mobile" />
            </nav>
        </>
    );
};

export default Sidebar;
