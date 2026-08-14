"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authInputClass, authInputInvalidClass, authLabelClass } from "@/components/auth/AuthCardShell";

type PasswordFieldProps = {
    id: string;
    name: string;
    label: string;
    autoComplete: string;
    minLength?: number;
    invalid?: boolean;
    describedBy?: string;
    inputRef?: RefObject<HTMLInputElement | null>;
    value?: string;
    onValueChange?: (value: string) => void;
    adornment?: ReactNode;
    children?: ReactNode;
};

export function PasswordField({ id, name, label, autoComplete, minLength, invalid, describedBy, inputRef, value, onValueChange, adornment, children }: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <label htmlFor={id} className={authLabelClass}>{label}</label>
            <div className="relative">
                <input
                    id={id}
                    ref={inputRef}
                    name={name}
                    type={visible ? "text" : "password"}
                    autoComplete={autoComplete}
                    minLength={minLength}
                    required
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    value={value}
                    onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
                    className={`${authInputClass} ${adornment ? "pr-[76px]" : "pr-12"} ${invalid ? authInputInvalidClass : ""}`}
                />
                {adornment && (
                    <span className="pointer-events-none absolute inset-y-0 right-11 grid place-items-center">
                        {adornment}
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => setVisible((current) => !current)}
                    aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
                    className="absolute inset-y-0 right-0 grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl text-nx-text-2 hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-nx-accent"
                >
                    {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
            </div>
            {children}
        </div>
    );
}
