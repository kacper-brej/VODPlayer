"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import completeOnboardingAction from "@/lib/profiles/completeOnboardingAction";
import skipOnboardingAction from "@/lib/profiles/skipOnboardingAction";
import {
    MAX_PROFILES_PER_ACCOUNT,
    PROFILE_AVATARS,
    type OnboardingSettingsInput,
    type ProfileAvatar,
} from "@/lib/core/onboarding";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { StepWelcome } from "@/components/onboarding/StepWelcome";
import { StepProfiles, type DraftProfile } from "@/components/onboarding/StepProfiles";
import { StepPreferences } from "@/components/onboarding/StepPreferences";

type Step = "welcome" | "profiles" | "preferences";

const STEP_INDEX: Record<Step, number> = {
    welcome: 0,
    profiles: 1,
    preferences: 2,
};

const STEP_EASE = [0.22, 1, 0.36, 1] as const;

const defaultSettings: OnboardingSettingsInput = {
    autoplayNext: true,
    autoPreviewsEnabled: true,
    reduceData: false,
};

const createKey = () => globalThis.crypto.randomUUID();

const validateProfiles = (profiles: DraftProfile[]) => {
    const errors: Record<string, string> = {};
    const names = new Map<string, string[]>();

    for (const profile of profiles) {
        const name = profile.name.trim();
        if (!name) errors[profile.key] = "Wpisz nazwę profilu.";
        else if (name.length > 50) errors[profile.key] = "Nazwa może mieć maksymalnie 50 znaków.";

        const normalized = name.toLocaleLowerCase("pl");
        if (normalized) names.set(normalized, [...(names.get(normalized) ?? []), profile.key]);
    }

    for (const keys of names.values()) {
        if (keys.length < 2) continue;
        for (const key of keys) errors[key] = "Każdy profil musi mieć inną nazwę.";
    }

    return errors;
};

interface OnboardingWizardProps {
    username: string;
}

export default function OnboardingWizard({ username }: OnboardingWizardProps) {
    const router = useRouter();
    const prefersReducedMotion = useReducedMotion();
    const headingRef = useRef<HTMLHeadingElement | null>(null);
    const [step, setStep] = useState<Step>("welcome");
    const [direction, setDirection] = useState(1);
    const [profiles, setProfiles] = useState<DraftProfile[]>([
        { key: "default-profile", name: username, avatar: PROFILE_AVATARS[0] },
    ]);
    const [settings, setSettings] = useState(defaultSettings);
    const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
    const [actionError, setActionError] = useState("");
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    const goTo = (next: Step) => {
        setActionError("");
        setDirection(STEP_INDEX[next] >= STEP_INDEX[step] ? 1 : -1);
        setStep(next);
    };

    const changeName = (key: string, name: string) => {
        setProfiles((items) => items.map((profile) => profile.key === key ? { ...profile, name } : profile));
        setProfileErrors((current) => {
            if (!current[key]) return current;
            const next = { ...current };
            delete next[key];
            return next;
        });
        setActionError("");
    };

    const changeAvatar = (key: string, avatar: ProfileAvatar) => {
        setProfiles((items) => items.map((profile) => profile.key === key ? { ...profile, avatar } : profile));
        setActionError("");
    };

    const addProfile = () => {
        if (profiles.length >= MAX_PROFILES_PER_ACCOUNT) return;
        const avatar = PROFILE_AVATARS[profiles.length % PROFILE_AVATARS.length] ?? PROFILE_AVATARS[0];
        setProfiles((items) => [...items, { key: createKey(), name: "", avatar }]);
        setActionError("");
    };

    const removeProfile = (key: string) => {
        setProfiles((items) => items.filter((profile) => profile.key !== key));
        setProfileErrors((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        setActionError("");
    };

    const openPreferences = () => {
        const errors = validateProfiles(profiles);
        setProfileErrors(errors);
        if (Object.keys(errors).length > 0) return;
        goTo("preferences");
    };

    const handleUnauthenticated = () => {
        router.replace("/login?returnTo=/welcome");
    };

    const skip = () => {
        setActionError("");
        startTransition(async () => {
            try {
                const result = await skipOnboardingAction();
                if (result.success) {
                    router.replace("/profiles");
                    return;
                }
                if (result.error === "unauthenticated") {
                    handleUnauthenticated();
                    return;
                }
                setActionError("Nie udało się pominąć konfiguracji. Spróbuj ponownie.");
            } catch {
                setActionError("Nie udało się pominąć konfiguracji. Spróbuj ponownie.");
            }
        });
    };

    const finish = () => {
        setActionError("");
        startTransition(async () => {
            try {
                const result = await completeOnboardingAction({
                    profiles: profiles.map(({ name, avatar }) => ({ name: name.trim(), avatar })),
                    settings,
                });

                if (result.success) {
                    router.replace("/profiles");
                    return;
                }
                if (result.error === "unauthenticated") {
                    handleUnauthenticated();
                    return;
                }

                setActionError(result.message ?? "Nie udało się zapisać konfiguracji. Spróbuj ponownie.");
                if (result.code && result.code !== "server") goTo("profiles");
            } catch {
                setActionError("Nie udało się zapisać konfiguracji. Spróbuj ponownie.");
            }
        });
    };

    return (
        <div className="relative min-h-dvh overflow-hidden bg-nx-bg px-5 text-nx-text sm:px-8">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[38vh] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--nx-accent)_13%,transparent),transparent_70%)]" />
            <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col py-7 sm:py-9 lg:py-10">
                <StepIndicator current={STEP_INDEX[step]} />

                <AnimatePresence initial={false} mode="wait">
                    <motion.div
                        key={step}
                        className="flex flex-1"
                        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 30 * direction, filter: "blur(4px)" }}
                        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -22 * direction, filter: "blur(3px)" }}
                        transition={{ duration: prefersReducedMotion ? 0.01 : 0.32, ease: STEP_EASE }}
                        onAnimationStart={() => {
                            window.requestAnimationFrame(() => headingRef.current?.focus());
                        }}
                    >
                        {step === "welcome" && (
                            <StepWelcome
                                headingRef={headingRef}
                                pending={pending}
                                error={actionError}
                                onStart={() => goTo("profiles")}
                                onSkip={skip}
                            />
                        )}
                        {step === "profiles" && (
                            <StepProfiles
                                headingRef={headingRef}
                                profiles={profiles}
                                errors={profileErrors}
                                formError={actionError}
                                onChangeName={changeName}
                                onChangeAvatar={changeAvatar}
                                onAdd={addProfile}
                                onRemove={removeProfile}
                                onBack={() => goTo("welcome")}
                                onNext={openPreferences}
                            />
                        )}
                        {step === "preferences" && (
                            <StepPreferences
                                headingRef={headingRef}
                                settings={settings}
                                pending={pending}
                                error={actionError}
                                onChange={(next) => { setSettings(next); setActionError(""); }}
                                onBack={() => goTo("profiles")}
                                onFinish={finish}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
