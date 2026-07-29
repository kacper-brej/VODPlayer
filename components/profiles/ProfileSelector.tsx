"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { Profile } from "@/lib/profiles";
import selectProfileAction from "@/lib/selectProfileAction";

const MAX_PROFILES = 5;

const PREFETCH_ROUTES = ["/"];

const TILE_SIZE = "w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40";
const TILE_RADIUS = "rounded-2xl";
const TILE_GLOW = "0 0 28px 4px var(--glow-primary)";

interface ProfileSelectorProps {
    profiles: Profile[];
}

const ProfileSelector = ({ profiles }: ProfileSelectorProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [pendingId, setPendingId] = useState<number | null>(null);
    const canAddProfile = profiles.length < MAX_PROFILES;

    useEffect(() => {
        PREFETCH_ROUTES.forEach((route) => router.prefetch(route));
    }, [router]);

    const handleSelect = (profile: Profile) => {
        if (isPending) return;

        setPendingId(profile.id);
        startTransition(async () => {
            await selectProfileAction(profile.id);
            router.push("/");
        });
    };

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-background">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-surface to-background" />

            <div
                className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    backgroundSize: "200px 200px",
                }}
            />

            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vh] h-[55vh] rounded-b-[50%] bg-primary/20 blur-[80px]" />
            <div className="absolute left-1/4 top-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse opacity-40" />
            <div className="absolute right-1/4 bottom-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px] animate-pulse delay-1000 opacity-40" />

            <div className="relative z-10 h-full w-full overflow-y-auto flex items-center justify-center px-4 py-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="w-full max-w-4xl flex flex-col items-center gap-10 md:gap-14"
                >
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                        Kto ogląda?
                    </h1>

                    <ul className="flex flex-wrap items-start justify-center gap-5 sm:gap-8 md:gap-10">
                        {profiles.map((profile, index) => (
                            <motion.li
                                key={profile.id}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + index * 0.08, duration: 0.5 }}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleSelect(profile)}
                                    disabled={isPending}
                                    aria-busy={pendingId === profile.id}
                                    className="group flex flex-col items-center gap-3 cursor-pointer outline-none disabled:cursor-wait"
                                >
                                    <div className="relative">
                                        <div
                                            className={`absolute -inset-1 ${TILE_RADIUS} opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-500`}
                                            style={{ boxShadow: TILE_GLOW }}
                                        />

                                        <div
                                            className={`relative ${TILE_SIZE} ${TILE_RADIUS} overflow-hidden bg-surface border border-border flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:border-border-hover group-focus-visible:scale-105 group-focus-visible:border-border-hover ${
                                                pendingId === profile.id ? "opacity-60" : ""
                                            }`}
                                        >
                                            <span className="text-3xl sm:text-4xl md:text-5xl font-semibold text-muted transition-colors duration-300 group-hover:text-foreground group-focus-visible:text-foreground">
                                                {profile.name.charAt(0).toUpperCase()}
                                            </span>

                                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-40" />
                                        </div>
                                    </div>

                                    <span className="text-xs sm:text-sm md:text-base text-muted group-hover:text-foreground group-focus-visible:text-foreground transition-colors duration-300">
                                        {profile.name}
                                    </span>
                                </button>
                            </motion.li>
                        ))}

                        {canAddProfile && (
                            <motion.li
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + profiles.length * 0.08, duration: 0.5 }}
                            >
                                <Link
                                    href="/profiles/create"
                                    className="group flex flex-col items-center gap-3 outline-none"
                                >
                                    <div className="relative">
                                        <div
                                            className={`absolute -inset-1 ${TILE_RADIUS} opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-500`}
                                            style={{ boxShadow: TILE_GLOW }}
                                        />

                                        <div
                                            className={`relative ${TILE_SIZE} ${TILE_RADIUS} overflow-hidden bg-surface/60 backdrop-blur-xl border border-dashed border-border flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:bg-surface-light/60 group-hover:border-border-hover group-focus-visible:scale-105 group-focus-visible:border-border-hover`}
                                        >
                                            <Plus
                                                strokeWidth={1.5}
                                                className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-muted transition-all duration-300 group-hover:text-primary group-hover:scale-110 group-focus-visible:text-primary"
                                            />

                                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-30" />
                                        </div>
                                    </div>

                                    <span className="text-xs sm:text-sm md:text-base text-muted group-hover:text-foreground group-focus-visible:text-foreground transition-colors duration-300">
                                        Dodaj profil
                                    </span>
                                </Link>
                            </motion.li>
                        )}
                    </ul>

                    <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.45 }}
                        className="group/manage relative cursor-pointer outline-none"
                    >
                        <div
                            className="absolute -inset-px rounded-lg opacity-0 group-hover/manage:opacity-100 group-focus-visible/manage:opacity-100 transition-opacity duration-300"
                            style={{ boxShadow: "0 0 18px 1px var(--glow-primary)" }}
                        />

                        <span className="relative block px-6 md:px-8 py-2.5 md:py-3 rounded-lg bg-surface/50 backdrop-blur-xl border border-border text-muted text-xs md:text-sm font-medium tracking-[0.15em] uppercase transition-colors duration-300 group-hover/manage:bg-surface-light/70 group-hover/manage:border-border-hover group-hover/manage:text-foreground group-focus-visible/manage:bg-surface-light/70 group-focus-visible/manage:border-border-hover group-focus-visible/manage:text-foreground">
                            Zarządzaj profilami
                        </span>
                    </motion.button>
                </motion.div>
            </div>
        </div>
    );
};

export default ProfileSelector;
