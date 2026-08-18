"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { PROFILE_AVATARS, type ProfileAvatar } from "@/lib/core/onboarding";
import { ProfileAvatarTile } from "@/components/profiles/ProfileAvatarTile";

interface AvatarPickerProps {
    value: ProfileAvatar | null;
    onChange: (value: ProfileAvatar) => void;
    onClose: () => void;
    autoFocus?: boolean;
}

export function AvatarPicker({ value, onChange, onClose, autoFocus = true }: AvatarPickerProps) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => {
        if (!autoFocus) return;
        const selectedIndex = value ? PROFILE_AVATARS.indexOf(value) : 0;
        refs.current[Math.max(0, selectedIndex)]?.focus();
    }, [autoFocus, value]);

    const moveSelection = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        let next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % PROFILE_AVATARS.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + PROFILE_AVATARS.length) % PROFILE_AVATARS.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = PROFILE_AVATARS.length - 1;
        else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
        } else return;

        event.preventDefault();
        const avatar = PROFILE_AVATARS[next]!;
        onChange(avatar);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label="Kolor profilu"
            className="grid grid-cols-4 gap-2 rounded-2xl border border-nx-border bg-nx-panel p-3 shadow-[var(--sh-3)] sm:grid-cols-8"
        >
            {PROFILE_AVATARS.map((avatar, index) => {
                const selected = value === avatar;
                return (
                    <button
                        key={avatar}
                        ref={(node) => { refs.current[index] = node; }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`Kolor ${index + 1}`}
                        tabIndex={selected || (!value && index === 0) ? 0 : -1}
                        onClick={() => onChange(avatar)}
                        onKeyDown={(event) => moveSelection(event, index)}
                        className="grid size-11 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent"
                    >
                        <ProfileAvatarTile
                            avatar={avatar}
                            name=""
                            showInitials={false}
                            className={`size-8 rounded-full transition-transform duration-[140ms] motion-reduce:transition-none ${selected ? "scale-100 ring-2 ring-nx-accent ring-offset-2 ring-offset-nx-panel" : "scale-90"}`}
                        />
                    </button>
                );
            })}
        </div>
    );
}
