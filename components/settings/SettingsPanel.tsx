"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Languages, PlayCircle, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import requestPasswordChangeAction from "@/lib/auth/requestPasswordChangeAction";
import updateSettingsAction from "@/lib/settings/updateSettingsAction";
import type { ProfileSettings } from "@/lib/settings/settings";
import { usePreviewPreferences } from "@/components/preview/PreviewPreferences";

interface SettingsPanelProps {
    initialSettings: ProfileSettings;
    loadFailed: boolean;
}

interface SwitchRowProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const SwitchRow = ({ label, description, checked, onChange }: SwitchRowProps) => (
    <div className="flex items-center justify-between gap-6 border-b border-nx-border py-5 last:border-b-0">
        <div>
            <p className="text-[15px] font-semibold text-nx-text">{label}</p>
            <p className="mt-1 max-w-[54ch] text-[13px] leading-5 text-nx-text-2">{description}</p>
        </div>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={`relative h-7 w-12 shrink-0 rounded-full border outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent ${
                checked
                    ? "border-nx-accent bg-nx-accent"
                    : "border-nx-border bg-nx-raised"
            }`}
        >
            <span
                className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full shadow-sm transition-[left,background-color] ${
                    checked ? "left-6 bg-nx-on-accent" : "left-1 bg-nx-text-2"
                }`}
            />
        </button>
    </div>
);

const sectionClass = "rounded-2xl border border-nx-border bg-nx-panel p-5 shadow-[0_18px_50px_-30px_rgba(0,0,0,.95)] sm:p-6";

const SettingsPanel = ({ initialSettings, loadFailed }: SettingsPanelProps) => {
    const { user } = useAuth();
    const { setPreviewPreferences } = usePreviewPreferences();
    const [settings, setSettings] = useState(initialSettings);
    const [savedSettings, setSavedSettings] = useState(initialSettings);
    const [message, setMessage] = useState(loadFailed ? "Nie udało się pobrać ustawień. Pokazujemy wartości domyślne." : "");
    const [messageKind, setMessageKind] = useState<"info" | "error">(loadFailed ? "error" : "info");
    const [pending, startTransition] = useTransition();
    const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

    const patchSetting = <Key extends keyof ProfileSettings>(key: Key, value: ProfileSettings[Key]) => {
        setSettings((current) => ({ ...current, [key]: value }));
        setMessage("");
    };

    const save = () => {
        setMessage("");
        startTransition(async () => {
            const result = await updateSettingsAction(settings);

            if (!result.success) {
                setMessageKind("error");
                setMessage("Nie udało się zapisać zmian. Spróbuj ponownie.");
                return;
            }

            setSettings(result.settings);
            setSavedSettings(result.settings);
            setPreviewPreferences({
                autoPreviewsEnabled: result.settings.autoPreviewsEnabled,
                reduceData: result.settings.reduceData,
            });
            setMessageKind("info");
            setMessage("Ustawienia zostały zapisane.");
        });
    };

    const requestPasswordChange = () => {
        setMessage("");
        startTransition(async () => {
            const result = await requestPasswordChangeAction();
            setMessageKind(result.success ? "info" : "error");
            setMessage(result.success
                ? "Wysłaliśmy wiadomość z linkiem do zmiany hasła."
                : "Nie udało się wysłać wiadomości. Spróbuj ponownie.");
        });
    };

    return (
        <div className="min-h-screen bg-nx-bg px-5 pb-[calc(96px+env(safe-area-inset-bottom))] pt-12 sm:px-8 lg:pb-20 lg:pt-16 xl:px-10 2xl:px-12">
            <div className="mx-auto w-full max-w-[1240px]">
                <header>
                    <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2 sm:text-[11px]">PROFIL / USTAWIENIA</span>
                    <h1 className="mt-4 font-display text-[36px] leading-none tracking-[-0.035em] text-nx-text sm:text-[44px] lg:text-[52px]">
                        Ustaw noc po swojemu
                    </h1>
                    <p className="mt-4 max-w-[58ch] text-[15px] leading-6 text-nx-text-2">
                        Te ustawienia dotyczą aktywnego profilu i są używane podczas oglądania.
                    </p>
                </header>

                <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-start">
                    <aside className="lg:sticky lg:top-24 lg:col-span-3">
                        <nav aria-label="Sekcje ustawień" className="rounded-2xl border border-nx-border bg-nx-panel p-2">
                            {[
                                { href: "#odtwarzanie", label: "Odtwarzanie", icon: PlayCircle },
                                { href: "#jezyk", label: "Język i dane", icon: Languages },
                                { href: "#konto", label: "Konto", icon: UserRound },
                            ].map(({ href, label, icon: Icon }) => (
                                <a key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-nx-text-2 transition-colors hover:bg-nx-raised hover:text-nx-text focus-visible:outline-2 focus-visible:outline-nx-accent">
                                    <Icon size={17} aria-hidden="true" />
                                    {label}
                                </a>
                            ))}
                        </nav>
                    </aside>

                    <div className="space-y-6 lg:col-span-9">
                        <section id="odtwarzanie" aria-labelledby="playback-heading" className={sectionClass}>
                            <div className="flex items-center gap-3">
                                <PlayCircle size={19} className="text-nx-accent" aria-hidden="true" />
                                <h2 id="playback-heading" className="text-lg font-semibold text-nx-text">Odtwarzanie</h2>
                            </div>
                            <div className="mt-3">
                                <SwitchRow
                                    label="Automatycznie odtwarzaj następny odcinek"
                                    description="Po napisach od razu przejdź do kolejnego dostępnego odcinka."
                                    checked={settings.autoplayNext}
                                    onChange={(value) => patchSetting("autoplayNext", value)}
                                />
                                <SwitchRow
                                    label="Automatyczne podglądy"
                                    description="Po zatrzymaniu kursora lub fokusu Nocturna uruchomi krótki, wyciszony podgląd. Nadal możesz włączyć go ręcznie."
                                    checked={settings.autoPreviewsEnabled}
                                    onChange={(value) => patchSetting("autoPreviewsEnabled", value)}
                                />
                                <SwitchRow
                                    label="Pokazuj pomijanie intro"
                                    description="Wyświetlaj dyskretny przycisk, gdy odcinek ma oznaczony początek czołówki."
                                    checked={settings.skipIntroPrompt}
                                    onChange={(value) => patchSetting("skipIntroPrompt", value)}
                                />
                                <div className="pt-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <label htmlFor="default-volume" className="text-[15px] font-semibold text-nx-text">Domyślna głośność</label>
                                            <p className="mt-1 text-[13px] text-nx-text-2">Poziom startowy odtwarzacza.</p>
                                        </div>
                                        <output htmlFor="default-volume" className="font-mono text-sm tabular-nums text-nx-accent">{settings.defaultVolume}%</output>
                                    </div>
                                    <input
                                        id="default-volume"
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={settings.defaultVolume}
                                        onChange={(event) => patchSetting("defaultVolume", Number(event.target.value))}
                                        className="mt-5 h-2 w-full cursor-pointer accent-nx-accent"
                                    />
                                </div>
                            </div>
                        </section>

                        <section id="jezyk" aria-labelledby="language-heading" className={sectionClass}>
                            <div className="flex items-center gap-3">
                                <Languages size={19} className="text-nx-accent" aria-hidden="true" />
                                <h2 id="language-heading" className="text-lg font-semibold text-nx-text">Język i transfer</h2>
                            </div>
                            <div className="mt-6 grid gap-5 sm:grid-cols-2">
                                <label className="text-sm text-nx-text">
                                    Preferowane audio
                                    <select
                                        value={settings.preferredAudioLang ?? ""}
                                        onChange={(event) => patchSetting("preferredAudioLang", event.target.value || null)}
                                        className="mt-2 h-12 w-full rounded-xl border border-nx-border bg-nx-raised px-4 text-sm text-nx-text outline-none focus-visible:border-nx-accent focus-visible:ring-2 focus-visible:ring-nx-accent/30"
                                    >
                                        <option value="">Automatycznie</option>
                                        <option value="pl">Polski</option>
                                        <option value="ja">Japoński</option>
                                        <option value="en">Angielski</option>
                                    </select>
                                </label>
                                <label className="text-sm text-nx-text">
                                    Preferowane napisy
                                    <select
                                        value={settings.preferredSubtitleLang ?? ""}
                                        onChange={(event) => patchSetting("preferredSubtitleLang", event.target.value || null)}
                                        className="mt-2 h-12 w-full rounded-xl border border-nx-border bg-nx-raised px-4 text-sm text-nx-text outline-none focus-visible:border-nx-accent focus-visible:ring-2 focus-visible:ring-nx-accent/30"
                                    >
                                        <option value="">Automatycznie</option>
                                        <option value="pl">Polski</option>
                                        <option value="en">Angielski</option>
                                        <option value="none">Bez napisów</option>
                                    </select>
                                </label>
                            </div>
                            <div className="mt-2">
                                <SwitchRow
                                    label="Oszczędzaj transfer"
                                    description="Preferuj lżejsze warianty materiałów i ogranicz wstępne ładowanie."
                                    checked={settings.reduceData}
                                    onChange={(value) => patchSetting("reduceData", value)}
                                />
                            </div>
                        </section>

                        <section id="konto" aria-labelledby="account-heading" className={sectionClass}>
                            <div className="flex items-center gap-3">
                                <ShieldCheck size={19} className="text-nx-accent" aria-hidden="true" />
                                <h2 id="account-heading" className="text-lg font-semibold text-nx-text">Konto i profil</h2>
                            </div>
                            <dl className="mt-5 divide-y divide-nx-border border-y border-nx-border">
                                <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                                    <dt className="text-sm text-nx-text-2">Nazwa użytkownika</dt>
                                    <dd className="text-sm text-nx-text">{user?.username ?? "—"}</dd>
                                </div>
                                <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                                    <dt className="text-sm text-nx-text-2">E-mail</dt>
                                    <dd className="text-sm text-nx-text">{user?.email ?? "—"}</dd>
                                </div>
                            </dl>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <Link href="/profiles" className="inline-flex min-h-11 items-center rounded-xl border border-nx-border px-4 text-sm font-semibold text-nx-text transition-colors hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent">
                                    Zarządzaj profilami
                                </Link>
                                <button type="button" onClick={requestPasswordChange} disabled={pending} className="min-h-11 rounded-xl border border-nx-border px-4 text-sm font-semibold text-nx-text transition-colors hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-55">
                                    Zmień hasło
                                </button>
                            </div>
                        </section>

                        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-2xl border border-nx-border bg-[color-mix(in_srgb,var(--nx-panel)_92%,transparent)] p-4 shadow-[0_18px_60px_rgba(0,0,0,.62)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:bottom-5">
                            <p role="status" aria-live="polite" className={`min-h-5 text-sm ${messageKind === "error" ? "text-nx-critical" : "text-nx-text-2"}`}>
                                {message || (dirty ? "Masz niezapisane zmiany." : "Wszystko jest aktualne.")}
                            </p>
                            <button
                                type="button"
                                onClick={save}
                                disabled={!dirty || pending}
                                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                <Check size={16} aria-hidden="true" />
                                {pending ? "Zapisywanie…" : "Zapisz ustawienia"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
