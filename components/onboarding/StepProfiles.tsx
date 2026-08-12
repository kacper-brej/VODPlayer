"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Palette, Plus, Trash2 } from "lucide-react";
import type { ProfileAvatar } from "@/lib/core/onboarding";
import { AvatarPicker } from "@/components/onboarding/AvatarPicker";
import { ProfileAvatarTile } from "@/components/profiles/ProfileAvatarTile";

export interface DraftProfile {
    key: string;
    name: string;
    avatar: ProfileAvatar | null;
}

interface StepProfilesProps {
    headingRef: RefObject<HTMLHeadingElement | null>;
    profiles: DraftProfile[];
    errors: Record<string, string>;
    formError: string;
    onChangeName: (key: string, name: string) => void;
    onChangeAvatar: (key: string, avatar: ProfileAvatar) => void;
    onAdd: () => void;
    onRemove: (key: string) => void;
    onBack: () => void;
    onNext: () => void;
}

export function StepProfiles({
    headingRef,
    profiles,
    errors,
    formError,
    onChangeName,
    onChangeAvatar,
    onAdd,
    onRemove,
    onBack,
    onNext,
}: StepProfilesProps) {
    const [openPicker, setOpenPicker] = useState<string | null>(null);
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        const firstInvalid = profiles.find((profile) => errors[profile.key]);
        if (firstInvalid) inputRefs.current[firstInvalid.key]?.focus();
    }, [errors, profiles]);

    return (
        <section className="grid w-full flex-1 content-center gap-10 py-10 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)] lg:gap-16 lg:py-12">
            <div className="lg:pt-8">
                <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="max-w-[12ch] font-display text-[38px] leading-[.96] tracking-[-.035em] text-nx-text outline-none sm:text-[48px] lg:text-[52px]"
                >
                    Kto będzie oglądał?
                </h2>
                <p className="mt-5 max-w-[34ch] text-[15px] leading-7 text-nx-text-2">
                    Każdy profil zachowuje własną historię i ustawienia.
                </p>
            </div>

            <div className="min-w-0">
                <p className="mb-4 text-right font-mono text-[10px] tracking-[0.16em] text-nx-text-2">
                    {profiles.length} Z 5 PROFILI
                </p>
                <div className="space-y-3">
                    {profiles.map((profile, index) => {
                        const pickerOpen = openPicker === profile.key;
                        const error = errors[profile.key];
                        return (
                            <div key={profile.key} className={`relative ${pickerOpen ? "z-20" : "z-0"}`}>
                                <div className="flex items-start gap-4 rounded-2xl border border-nx-border bg-nx-panel p-4 shadow-[var(--sh-1)] sm:items-center sm:p-5">
                                    <button
                                        type="button"
                                        aria-label={`Wybierz kolor profilu ${profile.name || index + 1}`}
                                        aria-expanded={pickerOpen}
                                        onClick={() => setOpenPicker((current) => current === profile.key ? null : profile.key)}
                                        className="group relative shrink-0 rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                                    >
                                        <ProfileAvatarTile avatar={profile.avatar} name={profile.name} className="size-[72px] rounded-2xl text-[22px]" />
                                        <span aria-hidden="true" className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border border-nx-border bg-nx-raised text-nx-text-2 group-hover:text-nx-text">
                                            <Palette className="size-3.5" />
                                        </span>
                                    </button>

                                    <div className="min-w-0 flex-1">
                                        <label htmlFor={`profile-${profile.key}`} className="mb-2 block text-sm font-medium text-nx-text">
                                            Nazwa profilu
                                        </label>
                                        <input
                                            ref={(node) => { inputRefs.current[profile.key] = node; }}
                                            id={`profile-${profile.key}`}
                                            value={profile.name}
                                            onChange={(event) => onChangeName(profile.key, event.target.value)}
                                            maxLength={50}
                                            autoComplete="off"
                                            aria-invalid={Boolean(error)}
                                            aria-describedby={error ? `profile-${profile.key}-error` : undefined}
                                            className="h-12 w-full rounded-xl border border-nx-border bg-nx-raised px-4 text-base text-nx-text outline-none placeholder:text-nx-text-2 focus-visible:border-nx-accent focus-visible:ring-2 focus-visible:ring-nx-accent/35"
                                            placeholder="Nazwa profilu"
                                        />
                                        {error && (
                                            <p id={`profile-${profile.key}-error`} role="alert" className="mt-2 text-[13px] leading-5 text-nx-critical">
                                                {error}
                                            </p>
                                        )}
                                    </div>

                                    {index > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => { setOpenPicker(null); onRemove(profile.key); }}
                                            aria-label={`Usuń profil ${profile.name || index + 1}`}
                                            className="grid size-11 shrink-0 place-items-center self-end rounded-full border border-nx-border text-nx-text-2 hover:bg-nx-raised hover:text-nx-critical focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent sm:self-center"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                                </div>

                                {pickerOpen && (
                                    <div className="mt-2 sm:absolute sm:left-4 sm:top-[calc(100%-2px)]">
                                        <AvatarPicker
                                            value={profile.avatar}
                                            onChange={(avatar) => onChangeAvatar(profile.key, avatar)}
                                            onClose={() => setOpenPicker(null)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {profiles.length < 5 && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-nx-border px-4 text-sm font-medium text-nx-text-2 hover:border-nx-text-2 hover:bg-nx-panel hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                    >
                        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full border border-nx-border">
                            <Plus className="size-4" />
                        </span>
                        Dodaj profil
                    </button>
                )}

                {formError && <p role="alert" className="mt-5 text-sm leading-6 text-nx-critical">{formError}</p>}

                <div className="mt-8 flex items-center justify-between gap-4">
                    <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-nx-text-2 hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent">
                        <ArrowLeft className="size-4" /> Wstecz
                    </button>
                    <button type="button" onClick={onNext} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-nx-accent px-6 text-sm font-semibold text-nx-on-accent hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent">
                        Dalej <ArrowRight className="size-4" />
                    </button>
                </div>
            </div>
        </section>
    );
}
