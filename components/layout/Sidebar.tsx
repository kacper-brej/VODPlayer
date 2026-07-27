"use client"
import {MENU_SECTIONS} from "@/config/menu";
import {useState} from "react";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import { Tv, Settings, LogOut, Menu} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const Sidebar = () => {
    const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
    const [isDesktopExpanded, setIsDesktopExpanded] = useState<boolean>(false);
    const isExpanded = isDesktopExpanded || isMobileOpen;
    const pathname = usePathname();
    const router = useRouter();
    const { logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    return (
        <>
            {/*Mobile*/}
            <button
                onClick = {() => setIsMobileOpen(true)}
                className='md:hidden fixed top-4 left-4 z-40 p-3
              bg-surface/50 backdrop-blur-xl border border-white/5 rounded-xl text-foreground transition-colors'
            >
                <Menu size={24} strokeWidth={2}/>
            </button>

            {isMobileOpen && (
                <div className='md:hidden fixed inset-0 bg-background/80
              backdrop-blur-sm z-40 transition-opacity'
                     onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/*Web*/}
          {/*Main SideBar */}
            <aside
                onMouseEnter={() => setIsDesktopExpanded(true)}
                onMouseLeave={() => setIsDesktopExpanded(false)}
                className={`fixed z-50 top-4 left-4 h-[calc(100dvh-32px)]  rounded-4xl bg-surface/50 backdrop-blur-xl border border-white/5
              flex flex-col justify-between py-6 transition-all duration-300 ease-in-out
              ${isMobileOpen ?  'translate-x-0' : 'translate-x-[-150%]'}
              md:translate-x-0
              ${isExpanded ?  'w-64' : 'w-20'}
           `}>
                {/*Navigation + logo*/}

                <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-3">
                    {/*Logo*/}
                    <div className="flex items-center justify-between mb-8 relative">
                        <Link href='/' className={`flex items-center group overflow-hidden transition-all duration-300 mx-auto ${isExpanded ? 'w-full' : 'w-11'}`}>
                            <div className="bg-primary/20 p-2 rounded-xl group-hover:glow-primary transition-all shrink-0">
                                <Tv className='text-primary' size={24}/>
                            </div>
                            <span className={`text-foreground font-bold text-xl whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                isExpanded ? 'max-w-52 opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'
                            }`}>
                              Nocturna
                          </span>
                        </Link>
                    </div>
                    {/*Navigation*/}
                    <div className="space-y-8">
                        {MENU_SECTIONS.map((section, i) => (
                            <div key={i}>
                                <ul>
                                    {section.items.map(({ name, href, icon: Icon }) => {
                                        const isActive = pathname === href;
                                        return (
                                        <li key={name}>
                                            <Link
                                                href={href}
                                                onClick={() => {setIsMobileOpen(false)}}
                                                title={!isExpanded ? name : undefined}
                                                className={`flex items-center py-2.5 px-3 rounded-xl transition-all duration-300 relative group overflow-hidden mx-auto ${
                                                    isActive ? 'bg-primary/10 text-primary glow-primary' : 'text-muted hover:text-foreground hover:bg-white/5'
                                                } ${isExpanded ? 'w-full' : 'w-11'}`}
                                            >
                                                <div className='shrink-0'>
                                                    <Icon size={20} strokeWidth={2}/>
                                                </div>
                                                <span
                                                    className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                                                        isExpanded ? 'max-w-52 opacity-100 ml-4' : 'max-w-0 opacity-0 ml-0'
                                                    }`}
                                                >
                                                  {name}
                                              </span>
                                            </Link>
                                        </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/*Lower nav */}
                <div className="space-y-2 border-t border-white/5 pt-4 mt-6 px-3">
                    <Link
                        href='/settings'
                        onClick={() => {setIsMobileOpen(false)}}
                        title={!isExpanded ? 'Settings' : undefined}
                        className={`flex items-center py-3 px-3 rounded-xl text-muted hover:text-foreground hover:bg-white/5 transition-all duration-300 relative overflow-hidden mx-auto ${
                            isExpanded ? 'w-full' : 'w-11'
                        }`}
                    >
                        <div className="shrink-0">
                            <Settings size={24} strokeWidth={2}/>
                        </div>
                        <span
                            className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                                isExpanded ? 'max-w-52 opacity-100 ml-4' : 'max-w-0 opacity-0 ml-0'
                            }`}
                        >
                          Settings
                      </span>
                    </Link>
                    <button
                        onClick={handleLogout}
                        title={!isExpanded ? 'Logout' : undefined}
                        className={`flex cursor-pointer items-center py-3 px-3 rounded-xl text-muted hover:text-danger hover:bg-danger/10 transition-all duration-300 relative overflow-hidden mx-auto ${
                            isExpanded ? 'w-full' : 'w-11'
                        }`}
                    >
                        <div className='shrink-0'>
                            <LogOut size={20} strokeWidth={2}/>
                        </div>
                        <span
                            className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                                isExpanded ? 'max-w-52 opacity-100 ml-4' : 'max-w-0 opacity-0 ml-0'
                            }`}
                        >
                        Logout
                      </span>
                    </button>
                </div>
            </aside>

        </>
    );
};
export default Sidebar;