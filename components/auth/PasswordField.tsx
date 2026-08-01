"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authInputClass } from "@/components/auth/AuthCardShell";

type PasswordFieldProps = {
    id: string;
    name: string;
    label: string;
    autoComplete: string;
    minLength?: number;
};

export function PasswordField({ id, name, label, autoComplete, minLength }: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <label htmlFor={id} className="mb-2 block text-sm font-medium text-nx-text">{label}</label>
            <div className="relative">
                <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} required className={`${authInputClass} pr-12`} />
                <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"} className="absolute inset-y-0 right-0 grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl text-nx-text-2 hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-nx-accent">
                    {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
            </div>
        </div>
    );
}
