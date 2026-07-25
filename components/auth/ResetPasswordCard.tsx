'use client'
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Tv, Lock, Eye, EyeClosed, ArrowRight } from 'lucide-react';
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "file:text-foreground placeholder:text-muted selection:bg-primary selection:text-background border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-primary focus-visible:ring-primary/40 focus-visible:ring-[3px]",
                className
            )}
            {...props}
        />
    )
}

export function ResetPasswordCard() {
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') ?? '';

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Hasła nie są takie same");
            return;
        }
        if (!token) {
            setError("Brak tokenu resetu hasła w linku.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reset-password.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/login'), 2000);
            } else {
                setError(data.error ?? 'Nie udało się zresetować hasła.');
            }
        } catch (error) {
            console.error(error);
            setError('Błąd połączenia z serwerem.');
        } finally {
            setIsLoading(false);
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
                className="w-full max-w-sm md:max-w-md relative z-10 px-4"
            >
                <div className="relative bg-surface/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 lg:p-10 border border-white/[0.05] shadow-2xl">
                    <div className="text-center space-y-1 md:space-y-2 mb-6">
                        <div className="mx-auto w-11 h-11 md:w-14 md:h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Tv className="text-primary w-5.5 h-5.5 md:w-7 md:h-7" />
                        </div>
                        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/80">
                            Ustaw nowe hasło
                        </h1>
                    </div>

                    {success ? (
                        <p className="text-center text-sm text-foreground">
                            Hasło zostało zmienione. Przenosimy Cię do logowania...
                        </p>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative flex items-center overflow-hidden rounded-lg">
                                <Lock className="absolute left-3 md:left-4 w-4 h-4 md:w-5 md:h-5 text-muted" />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Nowe hasło"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="w-full bg-surface-light/50 border-transparent focus:border-primary/40 text-foreground placeholder:text-muted h-10 md:h-12 pl-10 md:pl-12 pr-10 md:pr-12 md:text-base focus:bg-surface-light"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 md:right-4 cursor-pointer"
                                >
                                    {showPassword ? (
                                        <Eye className="w-4 h-4 md:w-5 md:h-5 text-muted hover:text-foreground transition-colors" />
                                    ) : (
                                        <EyeClosed className="w-4 h-4 md:w-5 md:h-5 text-muted hover:text-foreground transition-colors" />
                                    )}
                                </button>
                            </div>

                            <div className="relative flex items-center overflow-hidden rounded-lg">
                                <Lock className="absolute left-3 md:left-4 w-4 h-4 md:w-5 md:h-5 text-muted" />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Potwierdź nowe hasło"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="w-full bg-surface-light/50 border-transparent focus:border-primary/40 text-foreground placeholder:text-muted h-10 md:h-12 pl-10 md:pl-12 pr-3 md:text-base focus:bg-surface-light"
                                />
                            </div>

                            {error && <p className="text-xs md:text-sm text-danger">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary text-background font-bold h-10 md:h-12 rounded-lg flex items-center justify-center gap-1 shadow-lg shadow-primary/25 disabled:opacity-60"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-background/70 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Zmień hasło
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>

                            <p className="text-center text-xs md:text-sm text-muted mt-2">
                                <Link href="/login" className="text-primary hover:text-primary-hover transition-colors font-medium">
                                    Wróć do logowania
                                </Link>
                            </p>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
