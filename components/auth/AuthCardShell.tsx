import type { ReactNode } from "react";
import { MoonStar } from "lucide-react";

type AuthCardShellProps = {
    title: string;
    description?: string;
    children: ReactNode;
};

export function AuthCardShell({ title, description, children }: AuthCardShellProps) {
    return (
        <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-nx-bg px-4 py-10 text-nx-text">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--nx-accent)_17%,transparent),transparent_68%)]" />
            <section className="relative w-full max-w-[420px] rounded-3xl border border-nx-border bg-nx-panel p-6 shadow-[0_24px_80px_rgba(0,0,0,.48)] sm:p-8" aria-labelledby="auth-title">
                <div className="mb-7">
                    <div aria-hidden="true" className="mb-5 grid size-11 place-items-center rounded-full border border-nx-border bg-nx-raised text-nx-accent">
                        <MoonStar className="size-5" />
                    </div>
                    <h1 id="auth-title" className="font-display text-[32px] leading-none tracking-[-0.02em] text-nx-text sm:text-4xl">
                        {title}
                    </h1>
                    {description && <p className="mt-3 text-sm leading-6 text-nx-text-2">{description}</p>}
                </div>
                {children}
            </section>
        </div>
    );
}

export const authInputClass = "h-12 w-full rounded-xl border border-nx-border bg-nx-raised px-4 text-base text-nx-text outline-none placeholder:text-nx-text-2 focus-visible:border-nx-accent focus-visible:ring-2 focus-visible:ring-nx-accent/35 disabled:opacity-60";
export const authPrimaryButtonClass = "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-nx-accent bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent transition-[background-color,opacity] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-60";
export const authSecondaryButtonClass = "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-nx-border bg-transparent px-5 text-sm font-semibold text-nx-text transition-[background-color,border-color] hover:border-border-hover hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-60";
export const authLinkClass = "inline-flex min-h-11 items-center text-sm font-medium text-nx-text-2 underline-offset-4 hover:text-nx-text hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent";
