"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, FormInput, QrCode, UserPlus } from "lucide-react";
import { AuthCardShell, authFooterLinkClass, authInputClass, authLabelClass, authPrimaryButtonClass } from "@/components/auth/AuthCardShell";
import { AuthModeSwitch } from "@/components/auth/AuthModeSwitch";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { QrLoginPanel } from "@/components/auth/QrLoginPanel";
import { registerAction, type AuthActionResult } from "@/lib/auth/authActions";

type SignUpMode = "form" | "qr";

const MODE_OPTIONS = [
    { value: "form", label: "Wypełnij formularz", icon: FormInput },
    { value: "qr", label: "Zarejestruj się kodem QR", icon: QrCode },
] as const;

export function SignUpCard() {
    const qrToken = useSearchParams().get("qrToken") ?? "";
    const [mode, setMode] = useState<SignUpMode>("form");
    const [result, setResult] = useState<AuthActionResult | null>(null);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pending, startTransition] = useTransition();
    const passwordsMatch = password.length > 0 && password === confirmPassword;

    useEffect(() => {
        const clearStatus = (event: KeyboardEvent) => {
            if (event.key === "Escape") setResult(null);
        };
        window.addEventListener("keydown", clearStatus);
        return () => window.removeEventListener("keydown", clearStatus);
    }, []);

    const submit = (formData: FormData) => {
        setResult(null);
        startTransition(async () => {
            const next = await registerAction(formData);
            setResult(next);
            if (next.ok) {
                setPassword("");
                setConfirmPassword("");
            }
        });
    };

    const title = mode === "qr"
        ? "Zeskanuj kod, aby założyć konto"
        : qrToken
            ? "Dokończ zakładanie konta"
            : "Wypełnij dane, aby założyć konto";
    const description = mode === "qr"
        ? "Rejestrację dokończysz na telefonie."
        : qrToken
            ? "Po potwierdzeniu adresu email pierwsze urządzenie zaloguje się automatycznie."
            : undefined;

    return (
        <AuthCardShell
            title={title}
            description={description}
            footer={<>Masz już konto? <Link href="/login" className={authFooterLinkClass}>Zaloguj się</Link></>}
        >
            {!qrToken && !result?.ok && (
                <AuthModeSwitch
                    name="signup-mode"
                    legend="Sposób rejestracji"
                    value={mode}
                    options={MODE_OPTIONS}
                    onChange={setMode}
                />
            )}
            {mode === "qr" ? (
                <QrLoginPanel mode="register" />
            ) : result?.ok ? (
                <div>
                    <AuthStatusMessage status="success" message={result.message} />
                    {qrToken && <p className="mt-3 text-sm leading-6 text-nx-text-2">Potwierdź adres email, a potem wróć do pierwszego urządzenia.</p>}
                    <Link href="/login" className={`${authPrimaryButtonClass} mt-[26px]`}>Przejdź do logowania</Link>
                </div>
            ) : (
                <form action={submit}>
                    {qrToken && <input type="hidden" name="qrToken" value={qrToken} />}
                    <div>
                        <label htmlFor="signup-name" className={authLabelClass}>Nazwa użytkownika</label>
                        <input
                            id="signup-name"
                            name="username"
                            autoComplete="username"
                            required
                            autoFocus
                            maxLength={50}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className={authInputClass}
                        />
                    </div>
                    <div className="mt-3">
                        <label htmlFor="signup-email" className={authLabelClass}>Adres email</label>
                        <input
                            id="signup-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className={authInputClass}
                        />
                    </div>
                    <div className="mt-3">
                        <PasswordField
                            id="signup-password"
                            name="password"
                            label="Hasło"
                            autoComplete="new-password"
                            minLength={8}
                            describedBy="signup-password-strength"
                            value={password}
                            onValueChange={setPassword}
                        >
                            <PasswordStrength id="signup-password-strength" value={password} />
                        </PasswordField>
                    </div>
                    <div className="mt-3">
                        <PasswordField
                            id="signup-confirm-password"
                            name="confirmPassword"
                            label="Powtórz hasło"
                            autoComplete="new-password"
                            minLength={8}
                            value={confirmPassword}
                            onValueChange={setConfirmPassword}
                            adornment={passwordsMatch
                                ? <><Check aria-hidden="true" className="size-4 text-nx-accent-2" /><span className="sr-only">Hasła są takie same</span></>
                                : undefined}
                        />
                    </div>
                    <AuthStatusMessage status={result ? "error" : null} message={result?.message ?? ""} />
                    <button type="submit" disabled={pending} className={`${authPrimaryButtonClass} mt-[26px]`}>
                        <UserPlus className="size-4" />
                        {pending ? "Tworzenie konta…" : "Załóż konto"}
                    </button>
                </form>
            )}
        </AuthCardShell>
    );
}
