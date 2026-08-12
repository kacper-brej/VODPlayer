"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, CircleCheck, RefreshCw } from "lucide-react";
import { authSecondaryButtonClass } from "@/components/auth/AuthCardShell";
import { checkQrSessionAction, createQrSessionAction } from "@/lib/auth/authActions";
import { useAuth } from "@/lib/auth/AuthContext";

type QrStatus = "loading" | "pending" | "approved" | "expired" | "error";

export function QrLoginPanel({
    onBack,
    mode = "login",
    returnTo = "/profiles",
}: {
    onBack: () => void;
    mode?: "login" | "register";
    returnTo?: string;
}) {
    const router = useRouter();
    const { setAuthenticatedUser } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [status, setStatus] = useState<QrStatus>("loading");
    const [awaitingVerification, setAwaitingVerification] = useState(false);

    const createSession = useCallback(async () => {
        setStatus("loading");
        setAwaitingVerification(false);
        const session = await createQrSessionAction(mode);
        if (!session) {
            setStatus("error");
            return;
        }
        setToken(session.token);
        setStatus("pending");
    }, [mode]);

    useEffect(() => {
        const timer = window.setTimeout(() => void createSession(), 0);
        return () => window.clearTimeout(timer);
    }, [createSession]);

    useEffect(() => {
        if (!token || status !== "pending") return;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const startedAt = Date.now();

        const poll = async () => {
            if (!active) return;
            if (Date.now() - startedAt >= 180_000) {
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
    }, [returnTo, router, status, token, setAuthenticatedUser]);

    const qrUrl = token && typeof window !== "undefined"
        ? mode === "register"
            ? `${window.location.origin}/signup?qrToken=${encodeURIComponent(token)}`
            : `${window.location.origin}/qr-confirm?token=${encodeURIComponent(token)}`
        : "";

    const pendingMessage = awaitingVerification
        ? "Konto utworzone. Potwierdź adres email na telefonie…"
        : mode === "register"
            ? "Zeskanuj kod i utwórz konto na telefonie. Kod jest ważny przez 3 minuty."
            : "Kod jest ważny przez 3 minuty. Oczekiwanie na potwierdzenie…";

    return (
        <div className="space-y-5">
            <div className="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-2xl bg-white p-4 text-center text-zinc-700">
                {status === "pending" && qrUrl && <QRCodeSVG value={qrUrl} level="M" className="size-full" />}
                {status === "loading" && <span className="text-sm">Generowanie kodu…</span>}
                {status === "approved" && (
                    <div className="grid place-items-center gap-3">
                        <CircleCheck className="size-9 text-violet-600" />
                        <span className="text-sm font-semibold">{mode === "register" ? "Konto potwierdzone" : "Urządzenie zatwierdzone"}</span>
                    </div>
                )}
                {(status === "expired" || status === "error") && (
                    <div className="space-y-4 px-4">
                        <p className="text-sm">{status === "expired" ? "Kod wygasł." : "Nie udało się wygenerować kodu."}</p>
                        <button type="button" onClick={createSession} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-700">
                            <RefreshCw className="size-4" />Wygeneruj nowy
                        </button>
                    </div>
                )}
            </div>
            <p className="min-h-10 text-center text-[13px] leading-5 text-nx-text-2" aria-live="polite">
                {status === "pending" ? pendingMessage : ""}
            </p>
            <button type="button" onClick={onBack} className={authSecondaryButtonClass}>
                <ArrowLeft className="size-4" />{mode === "register" ? "Wróć do formularza" : "Wróć do hasła"}
            </button>
        </div>
    );
}
