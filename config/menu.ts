import { Home, Compass, Bookmark, PlaySquare, Clock, Upload, LayoutGrid, FolderOpen, Download } from "lucide-react";
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
    { name: "Kontynuuj", icon: PlaySquare, href: "/continue" },
    { name: "Ostatnio dodane", icon: Clock, href: "/recent" },
];

export const QUICK_JUMP_ITEMS: NavItem[] = [
    { name: "Wyślij plik", icon: Upload, href: "/upload" },
    { name: "Gatunki", icon: LayoutGrid, href: "/genres" },
    { name: "Kolekcje", icon: FolderOpen, href: "/collections" },
    { name: "Pobrane", icon: Download, href: "/downloads" },
];
