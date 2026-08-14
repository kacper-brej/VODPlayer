"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LogIn, QrCode } from "lucide-react";
import { AuthCardShell, authFooterLinkClass, authInputClass, authLabelClass, authLinkClass, authPrimaryButtonClass, authSecondaryButtonClass } from "@/components/auth/AuthCardShell";
import { AuthModeSwitch } from "@/components/auth/AuthModeSwitch";
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { PasswordField } from "@/components/auth/PasswordField";
import { RememberMeField } from "@/components/auth/RememberMeField";
import { QrLoginPanel } from "@/components/auth/QrLoginPanel";
import { loginAction, resendVerificationAction, type AuthActionResult } from "@/lib/auth/authActions";
import { useAuth } from "@/lib/auth/AuthContext";
import { safeReturnPath } from "@/lib/core/routes";

type SignInMode = "password" | "qr";

const MODE_OPTIONS = [
    { value: "password", label: "Zaloguj się hasłem", icon: KeyRound },
    { value: "qr", label: "Zaloguj się kodem QR", icon: QrCode },
] as const;

export function SignInCard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setAuthenticatedUser } = useAuth();
    const [mode, setMode] = useState<SignInMode>("password");
    const [result, setResult] = useState<AuthActionResult | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [failureCount, setFailureCount] = useState(0);
    const [pending, startTransition] = useTransition();
    const passwordRef = useRef<HTMLInputElement>(null);
    const returnTo = safeReturnPath(searchParams.get("returnTo"));

    useEffect(() => {
        const clearStatus = (event: KeyboardEvent) => {
            if (event.key === "Escape") setResult(null);
        };
        window.addEventListener("keydown", clearStatus);
        return () => window.removeEventListener("keydown", clearStatus);
    }, []);

    useEffect(() => {
        if (failureCount > 0) passwordRef.current?.focus();
    }, [failureCount]);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setResult(null);
        startTransition(async () => {
            const next = await loginAction(formData);
            setResult(next);
            if (next.ok && next.user) {
                setAuthenticatedUser(next.user);
                router.replace(returnTo);
                return;
            }
            setPassword("");
            setFailureCount((count) => count + 1);
        });
    };

    const resendVerification = () => {
        startTransition(async () => setResult(await resendVerificationAction(email)));
    };

    const verified = searchParams.get("verified");
    const verifiedResult: AuthActionResult | null = verified === "1"
        ? { ok: true, message: "Adres email został potwierdzony. Możesz się zalogować." }
        : verified === "0"
            ? { ok: false, message: "Link potwierdzający jest nieprawidłowy lub wygasł." }
            : null;
    const status = result ?? verifiedResult;
    const passwordInvalid = Boolean(result && !result.ok);

    return (
        <AuthCardShell
            title={mode === "qr" ? "Zeskanuj kod, aby się zalogować" : "Wprowadź dane, aby się zalogować"}
            description={mode === "qr" ? "Użyj urządzenia, na którym masz już aktywną sesję." : undefined}
            footer={<>Nie masz konta? <Link href="/signup" className={authFooterLinkClass}>Załóż konto</Link></>}
        >
            <AuthModeSwitch
                name="signin-mode"
                legend="Sposób logowania"
                value={mode}
                options={MODE_OPTIONS}
                onChange={setMode}
            />
            {mode === "qr" ? <QrLoginPanel returnTo={returnTo} /> : (
                <form onSubmit={submit}>
                    <div>
                        <label htmlFor="login-email" className={authLabelClass}>Adres email</label>
                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            autoFocus
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className={authInputClass}
                        />
                    </div>
                    <div className="mt-3">
                        <PasswordField
                            id="login-password"
                            name="password"
                            label="Hasło"
                            autoComplete="current-password"
                            invalid={passwordInvalid}
                            inputRef={passwordRef}
                            value={password}
                            onValueChange={setPassword}
                        />
                    </div>
                    <AuthStatusMessage status={status ? status.ok ? "success" : "error" : null} message={status?.message ?? ""} />
                    <RememberMeField trailing={<Link href="/forgot-password" className={authLinkClass}>Nie pamiętasz hasła?</Link>} />
                    {result?.code === "invalid" && (
                        <button type="button" onClick={resendVerification} disabled={pending} className={`${authSecondaryButtonClass} mt-3`}>
                            Wyślij link potwierdzający ponownie
                        </button>
                    )}
                    <button type="submit" disabled={pending || result?.ok} className={`${authPrimaryButtonClass} mt-[26px]`}>
                        <LogIn className="size-4" />
                        {pending ? "Logowanie…" : "Zaloguj się"}
                    </button>
                </form>
            )}
        </AuthCardShell>
    );
}
