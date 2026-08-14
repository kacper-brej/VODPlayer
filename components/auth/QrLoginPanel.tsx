"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { CircleCheck, RefreshCw } from "lucide-react";
import { authSecondaryButtonClass } from "@/components/auth/AuthCardShell";
import { checkQrSessionAction, createQrSessionAction } from "@/lib/auth/authActions";
import { useAuth } from "@/lib/auth/AuthContext";

type QrStatus = "loading" | "pending" | "approved" | "expired" | "error";

const formatRemaining = (milliseconds: number): string => {
    const total = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function QrLoginPanel({
    mode = "login",
    returnTo = "/profiles",
}: {
    mode?: "login" | "register";
    returnTo?: string;
}) {
    const router = useRouter();
    const { setAuthenticatedUser } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [status, setStatus] = useState<QrStatus>("loading");
    const [awaitingVerification, setAwaitingVerification] = useState(false);
    const [lifetimeMs, setLifetimeMs] = useState(0);
    const [expiresAt, setExpiresAt] = useState(0);
    const [remainingMs, setRemainingMs] = useState(0);

    const createSession = useCallback(async () => {
        setStatus("loading");
        setAwaitingVerification(false);
        const session = await createQrSessionAction(mode);
        if (!session) {
            setStatus("error");
            return;
        }
        const lifetime = session.expiresIn * 1000;
        setToken(session.token);
        setLifetimeMs(lifetime);
        setExpiresAt(Date.now() + lifetime);
        setRemainingMs(lifetime);
        setStatus("pending");
    }, [mode]);

    useEffect(() => {
        const timer = window.setTimeout(() => void createSession(), 0);
        return () => window.clearTimeout(timer);
    }, [createSession]);

    useEffect(() => {
        if (status !== "pending" || !expiresAt) return;
        const tick = () => setRemainingMs(Math.max(0, expiresAt - Date.now()));
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [expiresAt, status]);

    useEffect(() => {
        if (!token || status !== "pending" || !expiresAt) return;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const poll = async () => {
            if (!active) return;
            if (Date.now() >= expiresAt) {
                setStatus("expired");
                return;
            }
            if (document.visibilityState === "hidden") {
                timer = setTimeout(poll, 2000);
                return;
            }
            const next = await checkQrSessionAction(token);
            if (!active) return;
            if (next.status === "approved") {
                setAuthenticatedUser(next.user);
                setStatus("approved");
                router.replace(returnTo);
                return;
            }
            if (next.status === "expired" || next.status === "error") {
                setStatus(next.status);
                return;
            }
            if (next.status === "verification") setAwaitingVerification(true);
            timer = setTimeout(poll, 2000);
        };

        timer = setTimeout(poll, 2000);
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [expiresAt, returnTo, router, status, token, setAuthenticatedUser]);

    const qrUrl = token && typeof window !== "undefined"
        ? mode === "register"
            ? `${window.location.origin}/signup?qrToken=${encodeURIComponent(token)}`
            : `${window.location.origin}/qr-confirm?token=${encodeURIComponent(token)}`
        : "";

    const pendingMessage = awaitingVerification
        ? "Konto utworzone. Potwierdź adres email na telefonie…"
        : `Kod wygaśnie za ${formatRemaining(remainingMs)}. Czekam na potwierdzenie.`;

    return (
        <div>
            <div className="mx-auto grid aspect-square w-full max-w-[190px] place-items-center rounded-2xl bg-white p-3 text-center text-zinc-700 shadow-[0_0_0_1px_var(--nx-border),0_14px_34px_-18px_color-mix(in_srgb,var(--nx-accent)_60%,transparent)]">
                {status === "pending" && qrUrl && <QRCodeSVG value={qrUrl} level="M" className="size-full" />}
                {status === "loading" && <span className="text-sm">Generowanie kodu…</span>}
                {status === "approved" && (
                    <div className="grid place-items-center gap-3">
                        <CircleCheck className="size-9 text-violet-600" />
                        <span className="text-sm font-semibold">{mode === "register" ? "Konto potwierdzone" : "Urządzenie zatwierdzone"}</span>
                    </div>
                )}
                {(status === "expired" || status === "error") && (
                    <p className="px-3 text-sm">{status === "expired" ? "Kod wygasł." : "Nie udało się wygenerować kodu."}</p>
                )}
            </div>
            {status === "pending" && lifetimeMs > 0 && (
                <div aria-hidden="true" className="mx-[34px] mt-3.5 h-[3px] overflow-hidden rounded-sm bg-nx-border">
                    <div
                        className="h-full rounded-sm bg-[linear-gradient(90deg,var(--nx-accent),var(--nx-accent-2))] transition-[width] duration-1000 ease-linear"
                        style={{ width: `${Math.round((remainingMs / lifetimeMs) * 100)}%` }}
                    />
                </div>
            )}
            <p className="mt-3.5 min-h-10 text-center text-[12.5px] leading-5 text-nx-text-2" aria-live="polite">
                {status === "pending" ? pendingMessage : ""}
            </p>
            {status !== "approved" && (
                <button type="button" onClick={createSession} disabled={status === "loading"} className={`${authSecondaryButtonClass} mt-[24px]`}>
                    <RefreshCw className="size-4" />
                    Wygeneruj nowy kod
                </button>
            )}
        </div>
    );
}
