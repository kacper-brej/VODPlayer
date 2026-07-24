import {
    Tv,
    Home,
    Compass,
    LayoutGrid,
    Bookmark,
    PlaySquare,
    Clock,
    FolderOpen,
    Download,
    Upload,
    Settings,
    LogOut,
} from "lucide-react";

export const MENU_SECTIONS = [
    {
        title: 'Menu',
        items: [
            { name: "Home", icon: Home, href: "/" },
            { name: "Explore", icon: Compass, href: "/explore" },
            { name: "Genres", icon: LayoutGrid, href: "/genres" },
            { name: "Favourites", icon: Bookmark, href: "/favourites" },
        ],
    },
    {
        title: 'Library',
        items: [
            { name: "Continue Watching", icon: PlaySquare, href: "/continue" },
            { name: "Recently Added", icon: Clock, href: "/recent" },
            { name: "My Collections", icon: FolderOpen, href: "/collections" },
            { name: "Downloads", icon: Download, href: "/downloads" },
            { name: "Upload", icon: Upload, href: "/upload" },
        ]
    }
]