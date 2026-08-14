"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";

export function RememberMeField({ trailing }: { trailing?: ReactNode }) {
    const [checked, setChecked] = useState(false);

    return (
        <div className="mt-1">
            <div className="flex flex-wrap items-center justify-between gap-x-4">
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-nx-text-2 hover:text-nx-text">
                    <input
                        name="rememberMe"
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setChecked(event.target.checked)}
                        className="peer sr-only"
                    />
                    <span
                        aria-hidden="true"
                        className="grid size-[18px] shrink-0 place-items-center rounded-md border border-nx-border bg-[#1A1723] text-transparent transition-colors peer-checked:border-nx-accent peer-checked:bg-nx-accent peer-checked:text-nx-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-nx-accent"
                    >
                        <Check className="size-3" strokeWidth={3.5} />
                    </span>
                    Zapamiętaj mnie
                </label>
                {trailing}
            </div>
            {checked && (
                <p className="mt-2 pl-[28px] text-[11.5px] leading-[1.45] text-nx-text-2/85">
                    Zaznacz tylko na własnym urządzeniu. Sesja potrwa 30 dni zamiast doby.
                </p>
            )}
        </div>
    );
}
