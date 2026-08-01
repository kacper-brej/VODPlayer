"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QrCode, UserPlus } from "lucide-react";
import { AuthCardShell, authInputClass, authLinkClass, authPrimaryButtonClass, authSecondaryButtonClass } from "@/components/auth/AuthCardShell";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { PasswordField } from "@/components/auth/PasswordField";
import { QrLoginPanel } from "@/components/auth/QrLoginPanel";
import { registerAction, type AuthActionResult } from "@/lib/authActions";

export function SignUpCard() {
    const qrToken = useSearchParams().get("qrToken") ?? "";
    const [result, setResult] = useState<AuthActionResult | null>(null);
    const [qrMode, setQrMode] = useState(false);
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
        startTransition(async () => setResult(await registerAction(formData)));
    };

    return (
        <AuthCardShell
            title={qrMode ? "Rejestracja przez QR" : qrToken ? "Dokończ rejestrację" : "Utwórz konto"}
            description={qrMode ? "Zeskanuj kod i dokończ zakładanie konta na telefonie." : qrToken ? "Po potwierdzeniu emaila pierwsze urządzenie zaloguje się automatycznie." : "Jedno konto, osobne profile i wspólna biblioteka Nocturny."}
        >
            {qrMode ? (
                <QrLoginPanel mode="register" onBack={() => setQrMode(false)} />
            ) : result?.ok ? (
                <div className="space-y-5">
                    <AuthStatusMessage status="success" message={result.message} />
                    {qrToken && <p className="text-sm leading-6 text-nx-text-2">Potwierdź adres email. Po potwierdzeniu wróć do pierwszego urządzenia.</p>}
                    <Link href="/login" className={authPrimaryButtonClass}>Przejdź do logowania</Link>
                </div>
            ) : (
                <form action={submit} className="space-y-4">
                    {qrToken && <input type="hidden" name="qrToken" value={qrToken} />}
                    <div>
                        <label htmlFor="signup-name" className="mb-2 block text-sm font-medium text-nx-text">Nazwa użytkownika</label>
                        <input id="signup-name" name="username" autoComplete="username" required autoFocus maxLength={50} className={authInputClass} />
                    </div>
                    <div>
                        <label htmlFor="signup-email" className="mb-2 block text-sm font-medium text-nx-text">Adres email</label>
                        <input id="signup-email" name="email" type="email" autoComplete="email" required className={authInputClass} />
                    </div>
                    <PasswordField id="signup-password" name="password" label="Hasło" autoComplete="new-password" minLength={8} />
                    <PasswordField id="signup-confirm-password" name="confirmPassword" label="Powtórz hasło" autoComplete="new-password" minLength={8} />
                    <p className="text-xs leading-5 text-nx-text-2">Hasło musi mieć co najmniej 8 znaków.</p>
                    <AuthStatusMessage status={result ? "error" : null} message={result?.message ?? ""} />
                    <button type="submit" disabled={pending} className={authPrimaryButtonClass}>
                        <UserPlus className="size-4" />
                        {pending ? "Tworzenie konta…" : "Załóż konto"}
                    </button>
                    {!qrToken && (
                        <button type="button" onClick={() => setQrMode(true)} className={authSecondaryButtonClass}>
                            <QrCode className="size-4" />Zarejestruj się kodem QR
                        </button>
                    )}
                    <p className="text-center text-sm text-nx-text-2">Masz już konto? <Link href="/login" className={authLinkClass}>Zaloguj się</Link></p>
                </form>
            )}
        </AuthCardShell>
    );
}
