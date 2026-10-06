"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, FolderOpen, HardDrive, HardDriveDownload, House, Images, Scissors, Users } from "lucide-react";
import s from "./admin.module.css";

const ADMIN_ITEMS = [
    { label: "Przegląd", href: "/admin", icon: House },
    { label: "Materiały i grafiki", href: "/admin/upload", icon: Images },
    { label: "Biblioteka", href: "/admin/library", icon: FolderOpen },
    { label: "Pomijanie i rozdziały", href: "/admin/chapters", icon: Scissors },
    { label: "Konta", href: "/admin/users", icon: Users },
];
const TECHNICAL_ITEMS = [
    { label: "Import z serwera", href: "/admin/library-scan", icon: HardDriveDownload },
    { label: "Magazyn plików", href: "/admin/storage", icon: HardDrive },
    { label: "Wydajność", href: "/admin/performance", icon: Activity },
];

export default function AdminSectionNav() {
    const pathname = usePathname();
    return <header className={s.navigation}>
        <div className={s.navHeader}>
            <strong>Panel administratora</strong>
            <Link href="/">Otwórz serwis <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        <nav aria-label="Panel administracyjny" className={s.navLinks}>
            {ADMIN_ITEMS.map(({ label, href, icon: Icon }) => <Link key={href} href={href} className={s.navLink} aria-current={pathname === href ? "page" : undefined}>
                <Icon size={16} aria-hidden="true" />{label}
            </Link>)}
        </nav>
        <nav aria-label="Narzędzia serwera" className={s.technicalNav}>
            {TECHNICAL_ITEMS.map(({ label, href, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
                <Icon size={14} aria-hidden="true" />{label}
            </Link>)}
        </nav>
    </header>;
}
