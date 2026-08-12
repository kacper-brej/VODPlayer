"use client";

import type { CSSProperties } from "react";
import type { Profile } from "@/lib/profiles/profiles";
import { ProfileAvatarTile } from "@/components/profiles/ProfileAvatarTile";

const HANDOFF_AVATAR_SIZE = 112;

export interface ProfileHandoffOrigin {
    left: number;
    top: number;
    width: number;
    height: number;
}

export type ProfileHandoffPhase = "loading" | "leaving";

interface ProfileHandoffProps {
    profile: Profile;
    origin: ProfileHandoffOrigin | null;
    phase: ProfileHandoffPhase;
    showSpinner: boolean;
}

type HandoffStyle = CSSProperties & {
    "--nx-handoff-x": string;
    "--nx-handoff-y": string;
    "--nx-handoff-scale": number;
};

const getOriginStyle = (origin: ProfileHandoffOrigin): HandoffStyle => ({
    left: origin.left,
    top: origin.top,
    width: origin.width,
    height: origin.height,
    "--nx-handoff-x": `calc(50vw - ${origin.left + origin.width / 2}px)`,
    "--nx-handoff-y": `calc(50vh - ${origin.top + origin.height / 2}px)`,
    "--nx-handoff-scale": HANDOFF_AVATAR_SIZE / origin.width,
});

export function ProfileHandoff({ profile, origin, phase, showSpinner }: ProfileHandoffProps) {
    return (
        <div
            className={`nx-profile-handoff${phase === "leaving" ? " nx-profile-handoff--leaving" : ""}`}
            role="status"
            aria-live="polite"
            aria-label={`Przygotowujemy profil ${profile.name}`}
        >
            <div
                className={`nx-profile-handoff-avatar ${origin ? "nx-profile-handoff-avatar--from-tile" : "nx-profile-handoff-avatar--center"}`}
                style={origin ? getOriginStyle(origin) : undefined}
            >
                <div className="nx-profile-handoff-avatar-visual">
                    <ProfileAvatarTile
                        avatar={profile.avatar}
                        name={profile.name}
                        className="size-full rounded-[26px] text-[28px] shadow-[0_24px_56px_-24px_rgba(0,0,0,.92)]"
                    />
                </div>
            </div>

            <div className={`nx-profile-handoff-progress${showSpinner ? " nx-profile-handoff-progress--visible" : ""}`}>
                <span className="nx-profile-handoff-spinner" aria-hidden="true" />
                <span className="nx-profile-handoff-label">Przygotowujemy Twój profil…</span>
            </div>
        </div>
    );
}
