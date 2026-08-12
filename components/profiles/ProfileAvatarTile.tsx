import type { CSSProperties } from "react";
import { isProfileAvatar, type ProfileAvatar } from "@/lib/core/onboarding";

const AVATAR_TONES: Record<ProfileAvatar, CSSProperties> = {
    "nx-01": {
        backgroundColor: "var(--nx-accent)",
        color: "var(--nx-on-accent)",
    },
    "nx-02": {
        backgroundColor: "var(--nx-accent-2)",
        color: "var(--nx-on-accent)",
    },
    "nx-03": {
        backgroundColor: "color-mix(in srgb, var(--nx-accent) 62%, var(--nx-accent-2))",
        color: "var(--nx-on-accent)",
    },
    "nx-04": {
        backgroundColor: "color-mix(in srgb, var(--nx-accent) 58%, var(--nx-raised))",
        color: "var(--nx-text)",
    },
    "nx-05": {
        backgroundColor: "color-mix(in srgb, var(--nx-accent-2) 58%, var(--nx-panel))",
        color: "var(--nx-text)",
    },
    "nx-06": {
        backgroundColor: "color-mix(in srgb, var(--nx-accent) 38%, var(--nx-text-2))",
        color: "var(--nx-text)",
    },
    "nx-07": {
        backgroundColor: "color-mix(in srgb, var(--nx-text-2) 64%, var(--nx-panel))",
        color: "var(--nx-text)",
    },
    "nx-08": {
        backgroundColor: "var(--nx-raised)",
        color: "var(--nx-text-2)",
    },
};

export const profileInitials = (name: string) =>
    name.trim().slice(0, 2).toLocaleUpperCase("pl") || "—";

interface ProfileAvatarTileProps {
    avatar: string | null;
    name: string;
    className?: string;
    showInitials?: boolean;
}

export function ProfileAvatarTile({
    avatar,
    name,
    className = "",
    showInitials = true,
}: ProfileAvatarTileProps) {
    const tone = isProfileAvatar(avatar) ? AVATAR_TONES[avatar] : undefined;

    return (
        <span
            aria-hidden="true"
            data-profile-avatar=""
            className={`grid shrink-0 place-items-center border border-nx-border bg-nx-panel font-mono text-nx-text-2 ${className}`}
            style={tone}
        >
            {showInitials ? profileInitials(name) : null}
        </span>
    );
}
