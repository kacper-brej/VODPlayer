"use client"
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, History, LogOut, RefreshCw, Search, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QUICK_JUMP_ITEMS } from "@/config/menu";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/lib/commandPalette";
import { useAuth } from "@/lib/AuthContext";
import { addRecentSearch, getRecentSearches } from "@/lib/recentSearches";
import { seriesPath } from "@/lib/routes";
import { DataErrorState } from "@/components/data/DataState";
import type { DataResult } from "@/lib/dataResult";
import revalidateCatalogAction from "@/lib/revalidateCatalogAction";

export interface SearchIndexEntry {
    key: string;
    title: string;
    year: number | null;
    episodeCount: number;
}

interface CommandPaletteProps {
    searchIndex: DataResult<SearchIndexEntry[]>;
}

type PaletteAction =
    | { kind: "navigate"; href: string }
    | { kind: "select-result"; href: string; title: string }
    | { kind: "select-recent"; query: string }
    | { kind: "refresh-catalog" }
    | { kind: "logout" };

interface PaletteItem {
    id: string;
    label: string;
    hint?: string | null;
    icon: LucideIcon;
    shortcut?: string;
    action: PaletteAction;
}

interface PaletteSection {
    title: string;
    items: PaletteItem[];
}

const DEBOUNCE_MS = 120;

const CommandPalette = ({ searchIndex }: CommandPaletteProps) => {
    const router = useRouter();
    const { logout } = useAuth();
    const prefersReducedMotion = useReducedMotion();
    const listboxId = useId();

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<Element | null>(null);
    const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

    useEffect(() => {
        const openPalette = () => {
            triggerRef.current = document.activeElement;
            setIsOpen(true);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
            event.preventDefault();
            openPalette();
        };

        window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, openPalette);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, openPalette);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const [wasOpen, setWasOpen] = useState(isOpen);
    if (isOpen !== wasOpen) {
        setWasOpen(isOpen);
        if (isOpen) {
            setQuery("");
            setDebouncedQuery("");
            setActiveIndex(0);
            setRecentSearches(getRecentSearches());
        }
    }

    useEffect(() => {
        if (!isOpen) return;
        const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => window.clearTimeout(focusTimer);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (!isOpen || typeof window === "undefined" || !window.visualViewport) return;
        const vv = window.visualViewport;
        const updateHeight = () => setViewportHeight(vv.height);
        updateHeight();
        vv.addEventListener("resize", updateHeight);
        return () => vv.removeEventListener("resize", updateHeight);
    }, [isOpen]);

    const trimmedQuery = debouncedQuery.trim();

    const resultItems: PaletteItem[] = useMemo(() => {
        if (!trimmedQuery || searchIndex.kind === "error") return [];

        const needle = trimmedQuery.toLowerCase();
        return searchIndex.data
            .filter((entry) => entry.title.toLowerCase().includes(needle))
            .slice(0, 8)
            .map((entry) => {
                const hintParts = [entry.year ? String(entry.year) : null, `${entry.episodeCount} odc.`].filter(
                    (part): part is string => Boolean(part),
                );

                return {
                    id: `result-${entry.key}`,
                    label: entry.title,
                    hint: hintParts.length ? hintParts.join(" · ") : null,
                    icon: Search,
                    action: { kind: "select-result", href: seriesPath(entry.key), title: entry.title } as const,
                };
            });
    }, [trimmedQuery, searchIndex]);

    const quickJumpItems: PaletteItem[] = useMemo(
        () =>
            QUICK_JUMP_ITEMS.map((item) => ({
                id: `quickjump-${item.href}`,
                label: item.name,
                icon: item.icon,
                action: { kind: "navigate", href: item.href } as const,
            })),
        [],
    );

    const actionItems: PaletteItem[] = useMemo(
        () => [
            {
                id: "action-refresh-catalog",
                label: isRefreshing ? "Odświeżanie katalogu…" : "Odśwież katalog",
                icon: RefreshCw,
                action: { kind: "refresh-catalog" } as const,
            },
            {
                id: "action-logout",
                label: "Wyloguj",
                icon: LogOut,
                action: { kind: "logout" } as const,
            },
        ],
        [isRefreshing],
    );

    const recentItems: PaletteItem[] = useMemo(
        () =>
            trimmedQuery
                ? []
                : recentSearches.map((entry) => ({
                      id: `recent-${entry}`,
                      label: entry,
                      icon: History,
                      action: { kind: "select-recent", query: entry } as const,
                  })),
        [recentSearches, trimmedQuery],
    );

    const sections: PaletteSection[] = useMemo(
        () => [
            ...(trimmedQuery ? [{ title: "Wyniki", items: resultItems }] : []),
            { title: "Szybkie przejście", items: quickJumpItems },
            { title: "Akcje", items: actionItems },
            ...(recentItems.length ? [{ title: "Ostatnie wyszukiwania", items: recentItems }] : []),
        ],
        [trimmedQuery, resultItems, quickJumpItems, actionItems, recentItems],
    );

    const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
    const clampedActiveIndex = flatItems.length ? Math.min(activeIndex, flatItems.length - 1) : 0;

    useEffect(() => {
        itemRefs.current = itemRefs.current.slice(0, flatItems.length);
    }, [flatItems]);

    useEffect(() => {
        itemRefs.current[clampedActiveIndex]?.scrollIntoView({ block: "nearest" });
    }, [clampedActiveIndex]);

    const close = () => {
        setIsOpen(false);
        const trigger = triggerRef.current;
        if (trigger instanceof HTMLElement) trigger.focus();
    };

    const runAction = (action: PaletteAction) => {
        if (action.kind === "navigate") {
            close();
            router.push(action.href);
        } else if (action.kind === "select-result") {
            addRecentSearch(action.title);
            close();
            router.push(action.href);
        } else if (action.kind === "select-recent") {
            setQuery(action.query);
        } else if (action.kind === "refresh-catalog") {
            if (isRefreshing) return;
            setIsRefreshing(true);
            revalidateCatalogAction()
                .then(() => router.refresh())
                .finally(() => setIsRefreshing(false));
            close();
        } else if (action.kind === "logout") {
            close();
            logout().then(() => router.push("/login"));
        }
    };

    const showNoResults = trimmedQuery.length > 0 && searchIndex.kind !== "error" && resultItems.length === 0;
    const showIndexError = trimmedQuery.length > 0 && searchIndex.kind === "error";

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (flatItems.length) setActiveIndex((clampedActiveIndex + 1) % flatItems.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (flatItems.length) setActiveIndex((clampedActiveIndex - 1 + flatItems.length) % flatItems.length);
        } else if (event.key === "Enter") {
            event.preventDefault();
            const item = flatItems[clampedActiveIndex];
            if (item) runAction(item.action);
        } else if (event.key === "Tab") {
            event.preventDefault();
        }
    };

    const handleOverlayKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    };

    const activeItemId = flatItems[clampedActiveIndex]?.id ? `${listboxId}-${flatItems[clampedActiveIndex].id}` : undefined;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    role="presentation"
                    className="fixed inset-0 z-[90] flex justify-center bg-[#07070A]/[0.62]"
                    style={viewportHeight ? { height: viewportHeight } : undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.28 }}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) close();
                    }}
                    onKeyDown={handleOverlayKeyDown}
                >
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Paleta poleceń"
                        className="absolute top-3 flex max-h-[calc(100%-24px)] w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl border border-border shadow-[0_4px_8px_rgba(0,0,0,0.5),0_34px_70px_-20px_rgba(0,0,0,0.9)] backdrop-blur-[26px] lg:top-[12vh] lg:w-[560px] xl:w-[640px]"
                        style={{ backgroundColor: "rgba(21,18,28,0.86)" }}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.2, 0.8, 0.25, 1] }}
                    >
                        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4">
                            <Search size={18} className="text-muted" aria-hidden="true" />
                            <input
                                ref={inputRef}
                                type="text"
                                role="combobox"
                                aria-expanded="true"
                                aria-controls={listboxId}
                                aria-activedescendant={activeItemId}
                                autoComplete="off"
                                placeholder="Szukaj tytułów, przejdź lub uruchom akcję…"
                                value={query}
                                onChange={(event) => {
                                    setActiveIndex(0);
                                    setQuery(event.target.value);
                                }}
                                onKeyDown={handleInputKeyDown}
                                className="h-14 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted/70"
                            />
                        </div>

                        <div id={listboxId} role="listbox" aria-label="Wyniki palety poleceń" className="flex-1 overflow-y-auto py-2">
                            {showIndexError && (
                                <div className="px-4 py-3">
                                    <DataErrorState reason={searchIndex.kind === "error" ? searchIndex.reason : "server"} compact onRetry={() => router.refresh()} />
                                </div>
                            )}

                            {showNoResults && !showIndexError && (
                                <div className="flex flex-col items-start gap-2 px-4 py-4">
                                    <p className="text-sm text-foreground">Nic nie pasuje do «{trimmedQuery}».</p>
                                    <button
                                        type="button"
                                        onClick={() => runAction({ kind: "navigate", href: "/explore" })}
                                        className="text-sm text-primary underline outline-none decoration-primary/40 underline-offset-2 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                                    >
                                        Przeglądaj katalog
                                    </button>
                                </div>
                            )}

                            {sections.map((section) => {
                                if (!section.items.length) return null;

                                return (
                                    <div key={section.title} className="px-2 py-1.5">
                                        <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                                            {section.title}
                                        </p>
                                        <ul>
                                            {section.items.map((item) => {
                                                const index = flatItems.indexOf(item);
                                                const isActive = index === clampedActiveIndex;
                                                const Icon = item.icon;

                                                return (
                                                    <li
                                                        key={item.id}
                                                        id={`${listboxId}-${item.id}`}
                                                        role="option"
                                                        aria-selected={isActive}
                                                        ref={(node) => {
                                                            itemRefs.current[index] = node;
                                                        }}
                                                        onMouseEnter={() => setActiveIndex(index)}
                                                        onClick={() => runAction(item.action)}
                                                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${
                                                            isActive ? "bg-surface-light" : ""
                                                        }`}
                                                        style={isActive ? { boxShadow: "inset 2px 0 0 0 var(--primary)" } : undefined}
                                                    >
                                                        <Icon size={16} className="shrink-0 text-muted" aria-hidden="true" />
                                                        <span className="flex-1 truncate text-sm text-foreground">{item.label}</span>
                                                        {item.hint && (
                                                            <span className="shrink-0 font-mono text-[10.5px] text-muted">{item.hint}</span>
                                                        )}
                                                        {item.shortcut && (
                                                            <span className="shrink-0 rounded-md border border-border bg-surface-light px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted">
                                                                {item.shortcut}
                                                            </span>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            })}

                            {!trimmedQuery && !flatItems.length && (
                                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                    <Compass size={20} className="text-muted" aria-hidden="true" />
                                    <p className="text-sm text-muted">Zacznij pisać, aby wyszukać tytuł.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CommandPalette;
