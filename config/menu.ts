import { Home, Compass, Bookmark, LayoutGrid, FolderOpen, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
    name: string;
    icon: LucideIcon;
    href: string;
}

export const NAV_ITEMS: NavItem[] = [
    { name: "Start", icon: Home, href: "/" },
    { name: "Katalog", icon: Compass, href: "/explore" },
    { name: "Moja lista", icon: Bookmark, href: "/favourites" },
];

export const QUICK_JUMP_ITEMS: NavItem[] = [
    { name: "Gatunki", icon: LayoutGrid, href: "/genres" },
    { name: "Kolekcje", icon: FolderOpen, href: "/collections" },
];

export const ADMIN_QUICK_JUMP_ITEM: NavItem = { name: "Panel", icon: ShieldCheck, href: "/admin" };
