'use client'
import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Unlock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import setSessionCookieAction from '@/lib/setSessionCookieAction';

type QrStatus = 'loading' | 'pending' | 'approved' | 'expired' | 'error';

export function QrLoginPanel({ onBack }: { onBack: () => void }) {
    const [token, setToken] = useState<string | null>(null);
    const [status, setStatus] = useState<QrStatus>('loading');
    const router = useRouter();
    const { refreshUser } = useAuth();
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const createSession = async () => {
        setStatus('loading');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr-create.php`, { method: 'POST' });
            if (!res.ok) throw new Error('create failed');
            const data = await res.json();
            setToken(data.token);
            setStatus('pending');
        } catch {
            setStatus('error');
        }
    };

    useEffect(() => {
        createSession();
    }, []);

    useEffect(() => {
        if (!token || status !== 'pending') return;

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr-check.php?token=${token}`, {
                    credentials: 'include',
                });
                const data = await res.json();

                if (data.status === 'approved') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    if (data.token) {
                        await setSessionCookieAction(data.token, false);
                    }
                    await refreshUser();
                    setStatus('approved');
                    setTimeout(() => {
                        router.push('/');
                    }, 700);
                } else if (data.status === 'expired') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setStatus('expired');
                }
            } catch {
                // pojedynczy nieudany poll ignorujemy, spróbujemy ponownie za 2s
            }
        }, 2000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [token, status, router]);

    const qrUrl = token && typeof window !== 'undefined'
        ? `${window.location.origin}/qr-confirm?token=${token}`
        : '';

    return (
        <div className="flex flex-col items-center gap-5 py-2">
            <div className="w-64 h-64 md:w-72 md:h-72 rounded-2xl bg-white p-4 flex items-center justify-center shadow-lg shrink-0">
                {status === 'pending' && qrUrl ? (
                    <QRCodeSVG value={qrUrl} size={256} level="M" className="w-full h-full" />
                ) : status === 'approved' ? (
                    <motion.div
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                        className="flex flex-col items-center gap-3 text-center px-4"
                    >
                        <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <Unlock className="w-6 h-6 text-emerald-500" />
                        </div>
                        <p className="text-sm font-semibold text-zinc-700">Zalogowano! Przekierowujemy…</p>
                    </motion.div>
                ) : status === 'expired' ? (
                    <div className="text-center px-4 space-y-3">
                        <p className="text-sm text-zinc-600">Kod wygasł</p>
                        <button
                            type="button"
                            onClick={createSession}
                            className="inline-flex items-center gap-1 text-primary text-sm font-medium"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Wygeneruj nowy
                        </button>
                    </div>
                ) : status === 'error' ? (
                    <div className="text-center px-4 space-y-3">
                        <p className="text-sm text-danger">Błąd generowania kodu.</p>
                        <button
                            type="button"
                            onClick={createSession}
                            className="inline-flex items-center gap-1 text-primary text-sm font-medium"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Spróbuj ponownie
                        </button>
                    </div>
                ) : (
                    <div className="w-8 h-8 border-2 border-zinc-300 border-t-primary rounded-full animate-spin" />
                )}
            </div>

            <p className="text-muted text-xs md:text-sm text-center max-w-xs">
                Zeskanuj kod telefonem, na którym jesteś zalogowany w Nocturnie, aby zalogować to urządzenie.
            </p>

            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onBack}
                className="w-full relative"
            >
                <div className="relative overflow-hidden bg-surface-light/50 text-foreground font-medium h-10 md:h-12 rounded-lg border border-border hover:border-primary/40 transition-all duration-300 flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-muted" />
                    <span className="text-xs md:text-sm">Wróć do logowania hasłem</span>
                </div>
            </motion.button>
        </div>
    );
}
