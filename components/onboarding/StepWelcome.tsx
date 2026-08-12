"use client";

import type { RefObject } from "react";
import { ArrowRight, MoonStar } from "lucide-react";

interface StepWelcomeProps {
    headingRef: RefObject<HTMLHeadingElement | null>;
    pending: boolean;
    error: string;
    onStart: () => void;
    onSkip: () => void;
}

export function StepWelcome({ headingRef, pending, error, onStart, onSkip }: StepWelcomeProps) {
    return (
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-12 sm:py-16">
            <div aria-hidden="true" className="mb-7 grid size-12 place-items-center rounded-full border border-nx-border bg-nx-raised text-nx-accent shadow-[var(--sh-1)]">
                <MoonStar className="size-5" />
            </div>
            <h2
                ref={headingRef}
                tabIndex={-1}
                className="max-w-[14ch] font-display text-[40px] leading-[.95] tracking-[-.035em] text-nx-text outline-none sm:text-[52px] lg:text-[60px]"
            >
                Witaj w Nocturnie
            </h2>
            <p className="mt-5 max-w-[44ch] text-[15px] leading-7 text-nx-text-2 sm:text-base">
                Najpierw ustaw profile i sposób oglądania. To potrwa chwilę.
            </p>

            {error && <p role="alert" className="mt-6 text-sm leading-6 text-nx-critical">{error}</p>}

            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <button
                    type="button"
                    onClick={onStart}
                    disabled={pending}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-nx-accent px-6 text-sm font-semibold text-nx-on-accent transition-colors duration-[140ms] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-55"
                >
                    Zaczynajmy <ArrowRight className="size-4" />
                </button>
                <button
                    type="button"
                    onClick={onSkip}
                    disabled={pending}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-nx-text-2 underline-offset-4 hover:text-nx-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-55"
                >
                    {pending ? "Zapisywanie…" : "Pomiń na razie"}
                </button>
            </div>
        </section>
    );
}
