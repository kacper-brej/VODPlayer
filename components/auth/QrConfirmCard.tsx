'use client'
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Tv, Mail, Lock, Unlock, Eye, EyeClosed } from 'lucide-react';
import { cn } from "@/lib/utils"
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";

type Phase = 'checking' | 'needsLogin' | 'confirm' | 'approved' | 'invalid';

interface CurrentUser {
    username: string;
    email: string;
}

export function QrConfirmCard() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token') ?? '';

    const [phase, setPhase] = useState<Phase>('checking');
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setPhase('invalid');
            return;
        }

        (async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me.php`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    setPhase('confirm');
                } else {
                    setPhase('needsLogin');
                }
            } catch {
                setPhase('needsLogin');
            }
        })();
    }, [token]);

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setStatus('loading');
        setStatusMessage("");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, rememberMe: false }),
            });

            if (res.ok) {
                setStatus('idle');
                const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me.php`, { credentials: 'include' });
                const meData = await meRes.json();
                setUser(meData.user);
                setPhase('confirm');
            } else {
                const data = await res.json();
                setStatus('error');
                setStatusMessage(data.error ?? 'Błędne dane logowania.');
            }
        } catch {
            setStatus('error');
            setStatusMessage('Błąd połączenia z serwerem.');
        }
    };

    const handleApprove = async () => {
        setStatus('loading');
        setStatusMessage("");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/qr-approve.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token }),
            });

            if (res.ok) {
                setStatus('idle');
                setPhase('approved');
            } else {
                const data = await res.json();
                setStatus('error');
                setStatusMessage(data.error ?? 'Nie udało się zatwierdzić logowania.');
            }
        } catch {
            setStatus('error');
            setStatusMessage('Błąd połączenia z serwerem.');
        }
    };

    return (
        <div className="min-h-screen w-full bg-background relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/25 via-surface to-background" />
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[120vh] h-[60vh] rounded-b-[50%] bg-primary/20 blur-[80px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-sm relative z-10 px-4"
            >
                <div className="relative bg-surface/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-white/[0.05] shadow-2xl">
                    <div className="text-center space-y-1 md:space-y-2 mb-6">
                        <div className="mx-auto w-11 h-11 md:w-14 md:h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Tv className="text-primary w-5.5 h-5.5 md:w-7 md:h-7" />
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/80">
                            Logowanie przez QR
                        </h1>
                    </div>

                    {phase === 'checking' && (
                        <div className="flex justify-center py-6">
                            <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
                        </div>
                    )}

                    {phase === 'invalid' && (
                        <p className="text-center text-sm text-danger">
                            Nieprawidłowy link. Wróć na telewizor i odśwież kod QR.
                        </p>
                    )}

                    {phase === 'needsLogin' && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <p className="text-center text-xs md:text-sm text-muted mb-2">
                                Zaloguj się, aby potwierdzić logowanie na telewizorze
                            </p>

                            <div className="relative flex items-center overflow-hidden rounded-lg">
                                <Mail className="absolute left-3 w-4 h-4 text-muted" />
                                <input
                                    type="email"
                                    placeholder="Adres email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className={cn(
                                        "w-full bg-surface-light/50 border border-transparent focus:border-primary/40 text-foreground placeholder:text-muted h-11 rounded-lg pl-10 pr-3 text-sm outline-none focus:bg-surface-light transition-all"
                                    )}
                                />
                            </div>

                            <div className="relative flex items-center overflow-hidden rounded-lg">
                                <Lock className="absolute left-3 w-4 h-4 text-muted" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Hasło"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className={cn(
                                        "w-full bg-surface-light/50 border border-transparent focus:border-primary/40 text-foreground placeholder:text-muted h-11 rounded-lg pl-10 pr-10 text-sm outline-none focus:bg-surface-light transition-all"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3"
                                >
                                    {showPassword ? (
                                        <Eye className="w-4 h-4 text-muted" />
                                    ) : (
                                        <EyeClosed className="w-4 h-4 text-muted" />
                                    )}
                                </button>
                            </div>

                            <AuthStatusMessage status={status === 'success' || status === 'error' ? status : null} message={statusMessage} />

                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full bg-primary text-background font-bold h-11 rounded-lg flex items-center justify-center shadow-lg shadow-primary/25 disabled:opacity-60"
                            >
                                {status === 'loading' ? (
                                    <div className="w-4 h-4 border-2 border-background/70 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    'Zaloguj się'
                                )}
                            </button>
                        </form>
                    )}

                    {phase === 'confirm' && user && (
                        <div className="text-center space-y-5">
                            <p className="text-sm text-foreground">
                                Zalogowano jako <span className="text-primary font-medium">{user.username}</span>.
                                Czy chcesz zalogować tym kontem swój telewizor?
                            </p>

                            <AuthStatusMessage status={status === 'success' || status === 'error' ? status : null} message={statusMessage} />

                            <button
                                type="button"
                                onClick={handleApprove}
                                disabled={status === 'loading'}
                                className="w-full bg-primary text-background font-bold h-11 rounded-lg flex items-center justify-center shadow-lg shadow-primary/25 disabled:opacity-60"
                            >
                                {status === 'loading' ? (
                                    <div className="w-4 h-4 border-2 border-background/70 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    'Zatwierdź logowanie'
                                )}
                            </button>
                        </div>
                    )}

                    {phase === 'approved' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center space-y-4 py-2"
                        >
                            <motion.div
                                initial={{ scale: 0, rotate: -25 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
                                className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center"
                            >
                                <Unlock className="w-6 h-6 text-emerald-400" />
                            </motion.div>
                            <p className="text-sm text-foreground">
                                Gotowe! Twój telewizor loguje się automatycznie. Możesz odłożyć telefon.
                            </p>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
