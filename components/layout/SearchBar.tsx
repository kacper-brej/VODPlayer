"use client";
import { Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const SearchBar = () => {
    const [isMobileExpanded, setIsMobileExpanded] = useState<boolean>(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isMobileExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isMobileExpanded]);

    return (
        <div className="fixed top-4 right-4 z-40 sm:relative sm:top-0 sm:right-0 flex justify-end w-full sm:max-w-md group hover:scale-105 focus-within:scale-105 duration-300 pointer-events-none">

            <button
                onClick={() => setIsMobileExpanded(true)}
                className={`sm:hidden p-3 bg-surface/50 backdrop-blur-xl border border-white/5
                rounded-xl text-foreground transition-all duration-300 shadow-lg pointer-events-auto
                ${isMobileExpanded ? "absolute opacity-0 invisible scale-90" : "opacity-100 visible scale-100"}`}
            >
                <Search size={24} strokeWidth={2} />
            </button>

            <div className={`absolute right-0 top-0 px-4 py-2.5 sm:relative flex items-center bg-surface/40 
                backdrop-blur-xl border border-white/5 rounded-full duration-500 ease-in-out origin-right
                focus-within:border-primary/50 focus-within:bg-surface/80 focus-within:shadow-[0_0_20px_rgba(139,92,246,0.15)]
                ${isMobileExpanded ? 'max-w-[calc(100%-2rem)] opacity-100 visible shadow-xl pointer-events-auto' : 'w-12 opacity-0 invisible pointer-events-none sm:pointer-events-auto sm:w-full sm:opacity-100 sm:visible sm:shadow-none'}`}>

                <Search
                    size={18}
                    strokeWidth={2}
                    className={`text-muted transition-colors duration-300 group-focus-within:text-primary shrink-0
                    ${!isMobileExpanded && "max-sm:hidden sm:block"}`}
                />

                <input
                    type="text"
                    ref={inputRef}
                    placeholder="Search..."
                    className="w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted/70 ml-0 sm:ml-3 px-2 sm:px-0"
                />

                <button
                    onClick={() => setIsMobileExpanded(false)}
                    className={`sm:hidden p-1.5 ml-2 text-muted hover:text-foreground shrink-0 hover:bg-white/10 rounded-full 
                    transition-colors duration-300 ${!isMobileExpanded && "hidden"}`}
                >
                    <X size={14} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
};

export default SearchBar;