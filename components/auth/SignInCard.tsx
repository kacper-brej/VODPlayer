"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, QrCode } from "lucide-react";
import { AuthCardShell, authInputClass, authLinkClass, authPrimaryButtonClass, authSecondaryButtonClass } from "@/components/auth/AuthCardShell";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { PasswordField } from "@/components/auth/PasswordField";
import { QrLoginPanel } from "@/components/auth/QrLoginPanel";
import { loginAction, resendVerificationAction, type AuthActionResult } from "@/lib/authActions";

export function SignInCard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [qrMode, setQrMode] = useState(false);
    const [result, setResult] = useState<AuthActionResult | null>(null);
    const [lastEmail, setLastEmail] = useState("");
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
        setLastEmail(String(formData.get("email") ?? ""));
        startTransition(async () => {
            const next = await loginAction(formData);
            setResult(next);
            if (next.ok) router.replace("/profiles");
        });
    };

    const resendVerification = () => {
        startTransition(async () => setResult(await resendVerificationAction(lastEmail)));
    };

    const verified = searchParams.get("verified");
    const verifiedResult = verified === "1"
        ? { ok: true, message: "Email confirmed. You can now sign in." }
        : verified === "0"
            ? { ok: false, message: "The confirmation link is invalid or has expired." }
            : null;

    return (
        <AuthCardShell title={qrMode ? "Zaloguj przez QR" : "Witaj ponownie"} description={qrMode ? "Zeskanuj kod na urządzeniu, na którym masz aktywną sesję." : "Zaloguj się, aby wrócić do swojej biblioteki."}>
            {qrMode ? <QrLoginPanel onBack={() => setQrMode(false)} /> : (
                <form action={submit} className="space-y-4">
                    <div>
                        <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-nx-text">Adres email</label>
                        <input id="login-email" name="email" type="email" autoComplete="email" required autoFocus className={authInputClass} />
                    </div>
                    <PasswordField id="login-password" name="password" label="Hasło" autoComplete="current-password" />
                    <div className="flex flex-wrap items-center justify-between gap-x-4">
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-nx-text-2">
                            <input name="rememberMe" type="checkbox" className="size-5 accent-nx-accent" />
                            Zapamiętaj mnie
                        </label>
                        <Link href="/forgot-password" className={authLinkClass}>Nie pamiętasz hasła?</Link>
                    </div>
                    <AuthStatusMessage status={(result ?? verifiedResult) ? (result ?? verifiedResult)!.ok ? "success" : "error" : null} message={(result ?? verifiedResult)?.message ?? ""} />
                    {result?.code === "unconfirmed" && (
                        <button type="button" onClick={resendVerification} disabled={pending} className={authSecondaryButtonClass}>Wyślij link potwierdzający ponownie</button>
                    )}
                    <button type="submit" disabled={pending || result?.ok} className={authPrimaryButtonClass}>
                        <LogIn className="size-4" />
                        {pending ? "Logowanie…" : "Zaloguj się"}
                    </button>
                    <button type="button" onClick={() => setQrMode(true)} className={authSecondaryButtonClass}>
                        <QrCode className="size-4" />
                        Użyj kodu QR
                    </button>
                    <p className="text-center text-sm text-nx-text-2">Nie masz konta? <Link href="/signup" className={authLinkClass}>Załóż konto</Link></p>
                </form>
            )}
        </AuthCardShell>
    );
}
