"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Smartphone } from "lucide-react";
import { AuthCardShell, authInputClass, authPrimaryButtonClass } from "@/components/auth/AuthCardShell";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { PasswordField } from "@/components/auth/PasswordField";
import { approveQrSessionAction, getCurrentUserAction, loginAction, type AuthActionResult } from "@/lib/authActions";
import type { AuthUser } from "@/lib/contracts";

type Phase = "checking" | "login" | "confirm" | "approved" | "invalid";

export function QrConfirmCard() {
    const token = useSearchParams().get("token") ?? "";
    const [phase, setPhase] = useState<Phase>(token ? "checking" : "invalid");
    const [user, setUser] = useState<AuthUser | null>(null);
    const [result, setResult] = useState<AuthActionResult | null>(null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        let active = true;
        if (!token) return;
        getCurrentUserAction().then((currentUser) => {
            if (!active) return;
            setUser(currentUser);
            setPhase(currentUser ? "confirm" : "login");
        });
        return () => {
            active = false;
        };
    }, [token]);

    useEffect(() => {
        const clearStatus = (event: KeyboardEvent) => {
            if (event.key === "Escape") setResult(null);
        };
        window.addEventListener("keydown", clearStatus);
        return () => window.removeEventListener("keydown", clearStatus);
    }, []);

    const signIn = (formData: FormData) => {
        setResult(null);
        startTransition(async () => {
            const next = await loginAction(formData);
            if (!next.ok) {
                setResult(next);
                return;
            }
            const currentUser = await getCurrentUserAction();
            if (!currentUser) {
                setResult({ ok: false, code: "server", message: "Could not verify the current user." });
                return;
            }
            setUser(currentUser);
            setPhase("confirm");
        });
    };

    const approve = () => {
        setResult(null);
        startTransition(async () => {
            const next = await approveQrSessionAction(token);
            setResult(next);
            if (next.ok) setPhase("approved");
        });
    };

    return (
        <AuthCardShell title="Potwierdź urządzenie" description="Zatwierdź logowanie na drugim ekranie.">
            {phase === "checking" && <p role="status" className="py-6 text-center text-sm text-nx-text-2">Sprawdzanie sesji…</p>}
            {phase === "invalid" && <AuthStatusMessage status="error" message="The QR link is missing or invalid." />}
            {phase === "login" && (
                <form action={signIn} className="space-y-4">
                    <div>
                        <label htmlFor="qr-email" className="mb-2 block text-sm font-medium text-nx-text">Adres email</label>
                        <input id="qr-email" name="email" type="email" autoComplete="email" required autoFocus className={authInputClass} />
                    </div>
                    <PasswordField id="qr-password" name="password" label="Hasło" autoComplete="current-password" />
                    <AuthStatusMessage status={result ? "error" : null} message={result?.message ?? ""} />
                    <button type="submit" disabled={pending} className={authPrimaryButtonClass}>{pending ? "Logowanie…" : "Zaloguj się"}</button>
                </form>
            )}
            {phase === "confirm" && user && (
                <div className="space-y-5">
                    <div className="flex items-center gap-3 rounded-xl border border-nx-border bg-nx-raised p-4">
                        <Smartphone aria-hidden="true" className="size-5 text-nx-accent" />
                        <p className="text-sm text-nx-text">Zaloguj urządzenie jako <strong>{user.username}</strong></p>
                    </div>
                    <AuthStatusMessage status={result ? result.ok ? "success" : "error" : null} message={result?.message ?? ""} />
                    <button type="button" onClick={approve} disabled={pending} className={authPrimaryButtonClass}>{pending ? "Zatwierdzanie…" : "Zatwierdź logowanie"}</button>
                </div>
            )}
            {phase === "approved" && (
                <div className="grid place-items-center gap-4 py-4 text-center">
                    <div className="grid size-12 place-items-center rounded-full border border-nx-border bg-nx-raised text-nx-accent"><Check className="size-6" /></div>
                    <p className="text-sm leading-6 text-nx-text">Gotowe. Drugie urządzenie może kontynuować logowanie.</p>
                </div>
            )}
        </AuthCardShell>
    );
}
