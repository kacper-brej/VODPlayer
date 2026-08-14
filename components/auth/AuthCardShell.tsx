import type { ReactNode } from "react";
import { MoonStar } from "lucide-react";

type AuthCardShellProps = {
    title: string;
    description?: string;
    footer?: ReactNode;
    children: ReactNode;
};

export function AuthCardShell({ title, description, footer, children }: AuthCardShellProps) {
    return (
        <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-nx-bg px-4 py-10 text-nx-text">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[52vh] bg-[radial-gradient(120%_62%_at_50%_-14%,color-mix(in_srgb,var(--nx-accent)_20%,transparent),transparent_62%)]" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[40vh] bg-[radial-gradient(72%_46%_at_88%_116%,color-mix(in_srgb,var(--nx-accent-2)_6%,transparent),transparent_66%)]" />
            <div aria-hidden="true" className="auth-grain pointer-events-none absolute inset-0 opacity-50" />
            <section
                className="auth-panel relative w-full max-w-[420px] rounded-[26px] border border-nx-border p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_30px_70px_-34px_rgba(0,0,0,.95)] before:absolute before:-top-px before:left-[22%] before:right-[22%] before:h-px before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--nx-accent)_55%,transparent),transparent)] before:content-[''] sm:p-7"
                aria-labelledby="auth-title"
            >
                <div className="mb-[18px]">
                    <div className="mb-4 flex items-center gap-2.5">
                        <span aria-hidden="true" className="grid size-[30px] place-items-center rounded-full border border-nx-border bg-nx-raised text-nx-accent shadow-[0_0_18px_-6px_color-mix(in_srgb,var(--nx-accent)_70%,transparent)]">
                            <MoonStar className="size-4" />
                        </span>
                        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-nx-text-2">Nocturna</span>
                    </div>
                    <h1 id="auth-title" className="font-display text-[27px] leading-[1.16] tracking-[-0.012em] text-nx-text">
                        {title}
                    </h1>
                    {description && <p className="mt-2 text-[13px] leading-[1.55] text-nx-text-2">{description}</p>}
                </div>
                {children}
                {footer && (
                    <div className="-mx-6 -mb-6 mt-[22px] border-t border-nx-border/70 px-6 pb-[18px] pt-[15px] text-center text-sm text-nx-text-2 sm:-mx-7 sm:-mb-7 sm:px-7">
                        {footer}
                    </div>
                )}
            </section>
        </div>
    );
}

export const authInputClass = "h-[45px] w-full rounded-xl border border-nx-border bg-[#1A1723] px-3.5 text-[15px] text-nx-text shadow-[inset_0_1px_2px_rgba(0,0,0,.35)] outline-none placeholder:text-nx-text-2/70 focus-visible:border-nx-accent focus-visible:shadow-[inset_0_1px_2px_rgba(0,0,0,.35),0_0_0_3px_color-mix(in_srgb,var(--nx-accent)_17%,transparent)] disabled:opacity-60";
export const authInputInvalidClass = "border-nx-critical shadow-[inset_0_1px_2px_rgba(0,0,0,.35),0_0_0_3px_color-mix(in_srgb,var(--nx-critical)_14%,transparent)] focus-visible:border-nx-critical focus-visible:shadow-[inset_0_1px_2px_rgba(0,0,0,.35),0_0_0_3px_color-mix(in_srgb,var(--nx-critical)_14%,transparent)]";
export const authLabelClass = "mb-1.5 block text-[12.5px] font-medium text-nx-text";
export const authPrimaryButtonClass = "inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[linear-gradient(180deg,#C7B2FF,#AC90FA)] px-5 text-sm font-semibold text-nx-on-accent shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_24px_-12px_color-mix(in_srgb,var(--nx-accent)_85%,transparent)] transition-[filter,opacity] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-60";
export const authSecondaryButtonClass = "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-nx-border bg-transparent px-5 text-[13.5px] font-medium text-nx-text transition-[background-color,border-color] hover:border-border-hover hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-60";
export const authLinkClass = "inline-flex min-h-11 items-center text-sm font-medium text-nx-text-2 underline-offset-4 hover:text-nx-text hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent";
export const authFooterLinkClass = "font-medium text-nx-text underline underline-offset-4 decoration-nx-border hover:decoration-nx-text focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent";
