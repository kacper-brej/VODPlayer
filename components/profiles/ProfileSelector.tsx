"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { Profile } from "@/lib/profiles/profiles";
import createProfileAction from "@/lib/profiles/createProfileAction";
import deleteProfileAction from "@/lib/profiles/deleteProfileAction";
import renameProfileAction from "@/lib/profiles/renameProfileAction";
import selectProfileAction from "@/lib/profiles/selectProfileAction";
import { useModalFocus } from "@/lib/core/useModalFocus";
import { preloadHeroPreview } from "@/lib/player/preloadHeroPreview";
import { ProfileAvatarTile } from "@/components/profiles/ProfileAvatarTile";
import {
    ProfileHandoff,
    type ProfileHandoffOrigin,
    type ProfileHandoffPhase,
} from "@/components/profiles/ProfileHandoff";

const MAX_PROFILES = 5;
const SPINNER_DELAY_MS = 240;
const HANDOFF_EXIT_MS = 360;

type DialogState =
    | { kind: "create" }
    | { kind: "rename"; profile: Profile }
    | { kind: "delete"; profile: Profile }
    | null;

interface HandoffState {
    profile: Profile;
    origin: ProfileHandoffOrigin | null;
    phase: ProfileHandoffPhase;
    showSpinner: boolean;
}

export default function ProfileSelector({ profiles: initialProfiles }: { profiles: Profile[] }) {
    const router = useRouter();
    const [profiles, setProfiles] = useState(initialProfiles);
    const [manage, setManage] = useState(false);
    const [dialog, setDialog] = useState<DialogState>(null);
    const [error, setError] = useState("");
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [handoff, setHandoff] = useState<HandoffState | null>(null);
    const [pending, startTransition] = useTransition();
    const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const autoSelectionStartedRef = useRef(false);
    const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeDialog = useCallback(() => setDialog(null), []);
    const dialogRef = useModalFocus<HTMLDivElement>(dialog !== null, closeDialog);

    const clearSpinnerTimer = useCallback(() => {
        if (spinnerTimerRef.current !== null) {
            clearTimeout(spinnerTimerRef.current);
            spinnerTimerRef.current = null;
        }
    }, []);

    const resetFailedHandoff = useCallback(() => {
        clearSpinnerTimer();
        setPendingId(null);
        setHandoff(null);
        setError("Nie udało się wybrać profilu.");
    }, [clearSpinnerTimer]);

    const beginProfileHandoff = useCallback((profile: Profile, origin: ProfileHandoffOrigin | null) => {
        setError("");
        setPendingId(profile.id);
        setHandoff({ profile, origin, phase: "loading", showSpinner: false });
        clearSpinnerTimer();
        spinnerTimerRef.current = setTimeout(() => {
            setHandoff((current) => current?.profile.id === profile.id && current.phase === "loading"
                ? { ...current, showSpinner: true }
                : current);
        }, SPINNER_DELAY_MS);

        startTransition(async () => {
            try {
                const result = await selectProfileAction(profile.id);
                if (!result.success) {
                    resetFailedHandoff();
                    return;
                }

                router.prefetch("/");
                await preloadHeroPreview(result.previewSource);
                clearSpinnerTimer();
                setHandoff((current) => current?.profile.id === profile.id
                    ? { ...current, phase: "leaving", showSpinner: false }
                    : current);

                // The spinner has no minimum display time. Only the short, visible
                // handoff remains before the ready route replaces this screen.
                const exitDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? 0
                    : HANDOFF_EXIT_MS;
                navigationTimerRef.current = setTimeout(() => router.replace("/"), exitDelay);
            } catch {
                resetFailedHandoff();
            }
        });
    }, [clearSpinnerTimer, resetFailedHandoff, router]);

    useEffect(() => () => {
        clearSpinnerTimer();
        if (navigationTimerRef.current !== null) clearTimeout(navigationTimerRef.current);
    }, [clearSpinnerTimer]);

    useEffect(() => {
        if (profiles.length === 1) {
            if (!autoSelectionStartedRef.current) {
                autoSelectionStartedRef.current = true;
                beginProfileHandoff(profiles[0], null);
            }
            return;
        }

        autoSelectionStartedRef.current = false;
        tileRefs.current[0]?.focus();
    }, [beginProfileHandoff, profiles]);

    const selectProfile = (profile: Profile, index: number) => {
        if (manage || pending) return;
        const avatar = tileRefs.current[index]?.querySelector<HTMLElement>("[data-profile-avatar]");
        const rect = avatar?.getBoundingClientRect();
        beginProfileHandoff(profile, rect ? {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        } : null);
    };

    const moveFocus = (event: React.KeyboardEvent, index: number) => {
        if (!profiles.length) return;
        let next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % profiles.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + profiles.length) % profiles.length;
        else return;
        event.preventDefault();
        tileRefs.current[next]?.focus();
    };

    const saveDialog = (formData: FormData) => {
        if (!dialog) return;
        setError("");
        const currentDialog = dialog;
        startTransition(async () => {
            if (currentDialog.kind === "create") {
                const result = await createProfileAction(String(formData.get("name") ?? ""));
                if ("error" in result) {
                    setError("Nie udało się utworzyć profilu.");
                    return;
                }
                setProfiles((items) => [...items, result]);
            } else if (currentDialog.kind === "rename") {
                const result = await renameProfileAction(currentDialog.profile.id, String(formData.get("name") ?? ""));
                if ("error" in result) {
                    setError("Nie udało się zmienić nazwy profilu.");
                    return;
                }
                setProfiles((items) => items.map((item) => item.id === result.id ? { ...item, name: result.name } : item));
            } else {
                const result = await deleteProfileAction(currentDialog.profile.id);
                if (!result.success) {
                    setError("Nie udało się usunąć profilu.");
                    return;
                }
                setProfiles((items) => items.filter((item) => item.id !== currentDialog.profile.id));
            }
            setDialog(null);
            router.refresh();
        });
    };

    if (profiles.length <= 1) {
        return (
            <div className="min-h-dvh bg-nx-bg text-nx-text">
                {handoff && <ProfileHandoff {...handoff} />}
                {error && <p role="alert" className="sr-only">{error}</p>}
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-nx-bg px-5 py-12 text-nx-text">
            <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-5xl flex-col items-center justify-center">
                <h1 className="font-display text-[28px] leading-[.95] tracking-[-.03em] sm:text-[34px] lg:text-[40px] xl:text-[44px]">{manage ? "Zarządzaj profilami" : "Kto ogląda?"}</h1>
                <p className="mt-3 min-h-5 text-center text-[13px] text-nx-text-2" role={error ? "alert" : "status"} aria-live="polite">{error || (manage ? "Zmień nazwę albo usuń wybrany profil." : "Wybierz profil, aby kontynuować.")}</p>

                <ul aria-label="Profile użytkownika" className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4 md:gap-x-6 xl:grid-cols-5 xl:gap-x-8">
                    {profiles.map((profile, index) => (
                        <li key={profile.id} className="w-24 md:w-[116px] xl:w-[132px]">
                            <button
                                ref={(node) => { tileRefs.current[index] = node; }}
                                type="button"
                                onClick={() => selectProfile(profile, index)}
                                onKeyDown={(event) => moveFocus(event, index)}
                                disabled={pending}
                                aria-label={manage ? `Profil ${profile.name}` : `Wybierz profil ${profile.name}`}
                                aria-busy={pendingId === profile.id}
                                title={profile.name}
                                className="group w-full cursor-pointer rounded-2xl text-center outline-none disabled:cursor-wait"
                            >
                                <ProfileAvatarTile
                                    avatar={profile.avatar}
                                    name={profile.name}
                                    className="size-24 rounded-2xl text-[22px] transition-[border-color,transform] duration-[280ms] group-hover:-translate-y-1 group-hover:border-nx-text-2 group-focus-visible:border-2 group-focus-visible:border-nx-accent group-focus-visible:outline-2 group-focus-visible:outline-offset-3 group-focus-visible:outline-nx-accent motion-reduce:transform-none motion-reduce:transition-none md:size-[116px] xl:size-[132px]"
                                />
                                <span className="mt-3 block truncate text-sm text-nx-text-2 group-hover:text-nx-text group-focus-visible:text-nx-text">{profile.name}</span>
                            </button>
                            {manage && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setDialog({ kind: "rename", profile })} aria-label={`Zmień nazwę profilu ${profile.name}`} className="grid min-h-11 cursor-pointer place-items-center rounded-lg border border-nx-border text-nx-text-2 hover:bg-nx-raised hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent"><Pencil className="size-4" /></button>
                                    <button type="button" onClick={() => setDialog({ kind: "delete", profile })} aria-label={`Usuń profil ${profile.name}`} className="grid min-h-11 cursor-pointer place-items-center rounded-lg border border-nx-border text-nx-critical hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent"><Trash2 className="size-4" /></button>
                                </div>
                            )}
                        </li>
                    ))}
                    {!manage && profiles.length < MAX_PROFILES && (
                        <li className="w-24 md:w-[116px] xl:w-[132px]">
                            <button type="button" onClick={() => setDialog({ kind: "create" })} className="group w-full cursor-pointer rounded-2xl text-center outline-none">
                                <span className="grid size-24 place-items-center rounded-2xl border border-dashed border-nx-border bg-transparent text-nx-text-2 transition-[background-color,border-color] group-hover:border-nx-text-2 group-hover:bg-nx-panel group-focus-visible:outline-2 group-focus-visible:outline-offset-3 group-focus-visible:outline-nx-accent md:size-[116px] xl:size-[132px]"><Plus className="size-7" /></span>
                                <span className="mt-3 block text-sm text-nx-text-2">Dodaj profil</span>
                            </button>
                        </li>
                    )}
                </ul>

                <button type="button" onClick={() => { setManage((value) => !value); setError(""); }} className="mt-12 min-h-11 cursor-pointer rounded-xl border border-nx-border px-6 text-[13.5px] text-nx-text-2 hover:bg-nx-panel hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent">
                    {manage ? "Gotowe" : "Zarządzaj profilami"}
                </button>
            </div>

            {dialog && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-nx-bg/85 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
                    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" tabIndex={-1} className="relative w-full max-w-sm rounded-2xl border border-nx-border bg-nx-panel p-6 shadow-[0_24px_80px_rgba(0,0,0,.65)] outline-none">
                        <button type="button" onClick={closeDialog} aria-label="Zamknij okno" className="absolute right-3 top-3 grid size-11 cursor-pointer place-items-center rounded-full text-nx-text-2 hover:bg-nx-raised hover:text-nx-text focus-visible:outline-2 focus-visible:outline-nx-accent"><X className="size-5" /></button>
                        <h2 id="profile-dialog-title" className="pr-10 font-display text-[28px] leading-none text-nx-text">
                            {dialog.kind === "create" ? "Nowy profil" : dialog.kind === "rename" ? "Zmień nazwę" : "Usunąć profil?"}
                        </h2>
                        <form action={saveDialog} className="mt-6 space-y-4">
                            {dialog.kind !== "delete" ? (
                                <div>
                                    <label htmlFor="profile-name" className="mb-2 block text-sm text-nx-text">Nazwa profilu</label>
                                    <input id="profile-name" name="name" defaultValue={dialog.kind === "rename" ? dialog.profile.name : ""} required maxLength={50} autoComplete="off" className="h-12 w-full rounded-xl border border-nx-border bg-nx-raised px-4 text-base text-nx-text outline-none focus-visible:border-nx-accent focus-visible:ring-2 focus-visible:ring-nx-accent/35" />
                                </div>
                            ) : <p className="text-sm leading-6 text-nx-text-2">Profil „{dialog.profile.name}” i jego osobisty postęp zostaną usunięte.</p>}
                            {error && <p role="alert" className="text-[13px] leading-5 text-nx-critical">{error}</p>}
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button type="button" onClick={closeDialog} className="min-h-11 cursor-pointer rounded-xl border border-nx-border px-4 text-sm text-nx-text hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-nx-accent">Anuluj</button>
                                <button type="submit" disabled={pending} className={`min-h-11 cursor-pointer rounded-xl border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-60 ${dialog.kind === "delete" ? "border-nx-critical bg-transparent text-nx-critical" : "border-nx-accent bg-nx-accent text-nx-on-accent"}`}>
                                    {pending ? "Zapisywanie…" : dialog.kind === "create" ? "Dodaj profil" : dialog.kind === "rename" ? "Zapisz nazwę" : "Usuń profil"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {handoff && <ProfileHandoff {...handoff} />}
        </div>
    );
}
