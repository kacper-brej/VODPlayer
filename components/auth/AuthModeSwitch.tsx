"use client";

import type { LucideIcon } from "lucide-react";

type AuthModeOption<TValue extends string> = {
    value: TValue;
    label: string;
    icon: LucideIcon;
};

type AuthModeSwitchProps<TValue extends string> = {
    name: string;
    legend: string;
    value: TValue;
    options: readonly [AuthModeOption<TValue>, AuthModeOption<TValue>];
    onChange: (value: TValue) => void;
};

export function AuthModeSwitch<TValue extends string>({ name, legend, value, options, onChange }: AuthModeSwitchProps<TValue>) {
    return (
        <fieldset className="mb-[18px] grid grid-cols-2 gap-[3px] rounded-xl border border-nx-border/70 bg-[#141119] p-[3px]">
            <legend className="sr-only">{legend}</legend>
            {options.map((option) => {
                const inputId = `${name}-${option.value}`;
                const Icon = option.icon;
                return (
                    <div key={option.value}>
                        <input
                            id={inputId}
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                            className="peer sr-only"
                        />
                        <label
                            htmlFor={inputId}
                            className="flex h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border border-transparent text-xs font-medium text-nx-text-2 transition-colors hover:text-nx-text peer-checked:border-nx-border peer-checked:bg-nx-raised peer-checked:text-nx-text peer-checked:shadow-[inset_0_1px_0_rgba(255,255,255,.06)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-nx-accent"
                        >
                            <Icon aria-hidden="true" className="size-[15px] shrink-0" />
                            {option.label}
                        </label>
                    </div>
                );
            })}
        </fieldset>
    );
}
