"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthCardShell, authLinkClass, authPrimaryButtonClass } from "@/components/auth/AuthCardShell";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { PasswordField } from "@/components/auth/PasswordField";
import { resetPasswordAction, type AuthActionResult } from "@/lib/authActions";

export function ResetPasswordCard() {
    const token = useSearchParams().get("token") ?? "";
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
        formData.set("token", token);
        setResult(null);
        startTransition(async () => setResult(await resetPasswordAction(formData)));
    };

    return (
        <AuthCardShell title="Nowe hasło" description="Ustaw nowe hasło do swojego konta.">
            {result?.ok ? (
                <div className="space-y-5">
                    <AuthStatusMessage status="success" message={result.message} />
                    <Link href="/login" className={authPrimaryButtonClass}>Zaloguj się</Link>
                </div>
            ) : (
                <form action={submit} className="space-y-4">
                    <PasswordField id="reset-password" name="password" label="Nowe hasło" autoComplete="new-password" minLength={8} />
                    <PasswordField id="reset-confirm-password" name="confirmPassword" label="Powtórz nowe hasło" autoComplete="new-password" minLength={8} />
                    <AuthStatusMessage status={result || !token ? "error" : null} message={result?.message ?? (!token ? "The reset link is missing or invalid." : "")} />
                    <button type="submit" disabled={pending || !token} className={authPrimaryButtonClass}>
                        <KeyRound className="size-4" />
                        {pending ? "Zapisywanie…" : "Zmień hasło"}
                    </button>
                    <div className="text-center"><Link href="/login" className={authLinkClass}>Wróć do logowania</Link></div>
                </form>
            )}
        </AuthCardShell>
    );
}
