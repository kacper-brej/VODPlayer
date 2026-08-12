"use client";

import type { RefObject } from "react";
import { ArrowLeft, ArrowRight, Check, PlayCircle, RadioTower, WifiOff } from "lucide-react";
import type { OnboardingSettingsInput } from "@/lib/core/onboarding";

interface PreferenceRowProps {
    icon: typeof PlayCircle;
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled: boolean;
}

function PreferenceRow({ icon: Icon, title, description, checked, onChange, disabled }: PreferenceRowProps) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-nx-border bg-nx-panel p-4 shadow-[var(--sh-1)] sm:p-5">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-nx-raised text-nx-accent">
                <Icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-nx-text">{title}</span>
                <span className="mt-1 block text-[13px] leading-5 text-nx-text-2">{description}</span>
            </span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={title}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={`relative h-7 w-12 shrink-0 rounded-full border outline-none transition-colors duration-[140ms] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-55 ${checked ? "border-nx-accent bg-nx-accent" : "border-nx-border bg-nx-raised"}`}
            >
                <span
                    aria-hidden="true"
                    className={`absolute top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full transition-[left,background-color] duration-[140ms] motion-reduce:transition-none ${checked ? "left-6 bg-nx-on-accent text-nx-accent" : "left-1 bg-nx-text-2 text-transparent"}`}
                >
                    <Check className="size-3" strokeWidth={3} />
                </span>
            </button>
        </div>
    );
}

interface StepPreferencesProps {
    headingRef: RefObject<HTMLHeadingElement | null>;
    settings: OnboardingSettingsInput;
    pending: boolean;
    error: string;
    onChange: (next: OnboardingSettingsInput) => void;
    onBack: () => void;
    onFinish: () => void;
}

export function StepPreferences({
    headingRef,
    settings,
    pending,
    error,
    onChange,
    onBack,
    onFinish,
}: StepPreferencesProps) {
    const update = <Key extends keyof OnboardingSettingsInput>(key: Key, value: OnboardingSettingsInput[Key]) => {
        onChange({ ...settings, [key]: value });
    };

    return (
        <section className="grid w-full flex-1 content-center gap-10 py-10 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)] lg:gap-16 lg:py-12">
            <div className="lg:pt-8">
                <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="max-w-[12ch] font-display text-[38px] leading-[.96] tracking-[-.035em] text-nx-text outline-none sm:text-[48px] lg:text-[52px]"
                >
                    Jak wolisz oglądać?
                </h2>
                <p className="mt-5 max-w-[34ch] text-[15px] leading-7 text-nx-text-2">
                    Te ustawienia możesz później zmienić.
                </p>
            </div>

            <div className="min-w-0">
                <div className="space-y-3">
                    <PreferenceRow
                        icon={PlayCircle}
                        title="Odtwarzaj następny odcinek automatycznie"
                        description="Po zakończeniu odcinka Nocturna rozpocznie kolejny."
                        checked={settings.autoplayNext}
                        disabled={pending}
                        onChange={(checked) => update("autoplayNext", checked)}
                    />
                    <PreferenceRow
                        icon={RadioTower}
                        title="Podgląd wideo po najechaniu"
                        description="Kafelki mogą automatycznie pokazywać krótki podgląd."
                        checked={settings.autoPreviewsEnabled}
                        disabled={pending}
                        onChange={(checked) => update("autoPreviewsEnabled", checked)}
                    />
                    <PreferenceRow
                        icon={WifiOff}
                        title="Oszczędzaj transfer"
                        description="Ogranicza automatyczne ładowanie materiałów wideo."
                        checked={settings.reduceData}
                        disabled={pending}
                        onChange={(checked) => update("reduceData", checked)}
                    />
                </div>

                {error && <p role="alert" className="mt-5 text-sm leading-6 text-nx-critical">{error}</p>}

                <div className="mt-8 flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        disabled={pending}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-nx-text-2 hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-55"
                    >
                        <ArrowLeft className="size-4" /> Wstecz
                    </button>
                    <button
                        type="button"
                        onClick={onFinish}
                        disabled={pending}
                        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-nx-accent px-6 text-sm font-semibold text-nx-on-accent hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-55"
                    >
                        {pending ? "Zapisywanie…" : "Zakończ"} <ArrowRight className="size-4" />
                    </button>
                </div>
            </div>
        </section>
    );
}
