"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { AuthCardShell, authInputClass, authLinkClass, authPrimaryButtonClass } from "@/components/auth/AuthCardShell";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { forgotPasswordAction, type AuthActionResult } from "@/lib/auth/authActions";

export function ForgotPasswordCard() {
    const [result, setResult] = useState<AuthActionResult | null>(null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        const clearStatus = (event: KeyboardEvent) => {
            if (event.key === "Escape") setResult(null);
        };
        window.addEventListener("keydown", clearStatus);
        return () => window.removeEventListener("keydown", clearStatus);
    }, []);

    const submit = (formData: FormData) => {
        setResult(null);
        startTransition(async () => setResult(await forgotPasswordAction(formData)));
    };

    return (
        <AuthCardShell title="Reset hasła" description="Podaj adres email przypisany do konta. Link będzie ważny przez godzinę.">
            <form action={submit} className="space-y-4">
                <div>
                    <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-nx-text">Adres email</label>
                    <input id="forgot-email" name="email" type="email" autoComplete="email" required autoFocus className={authInputClass} />
                </div>
                <AuthStatusMessage status={result ? result.ok ? "success" : "error" : null} message={result?.message ?? ""} />
                <button type="submit" disabled={pending} className={authPrimaryButtonClass}>
                    <Send className="size-4" />
                    {pending ? "Wysyłanie…" : "Wyślij link"}
                </button>
                <div className="text-center">
                    <Link href="/login" className={authLinkClass}><ArrowLeft className="mr-2 size-4" />Wróć do logowania</Link>
                </div>
            </form>
        </AuthCardShell>
    );
}
