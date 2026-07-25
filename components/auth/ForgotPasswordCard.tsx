'use client'
import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Tv, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
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

export function ForgotPasswordCard() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/forgot-password.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (res.ok) {
                setSent(true);
            } else {
                setError('Wystąpił błąd. Spróbuj ponownie.');
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
                            Zapomniałeś hasła?
                        </h1>
                        <p className="text-muted text-xs md:text-sm">
                            Podaj swój email, wyślemy Ci link do zresetowania hasła
                        </p>
                    </div>

                    {sent ? (
                        <div className="text-center space-y-4">
                            <p className="text-sm text-foreground">
                                Jeśli konto istnieje, wysłaliśmy wiadomość z linkiem resetującym hasło na podany adres email.
                            </p>
                            <Link href="/login" className="inline-flex items-center gap-1 text-primary text-sm font-medium hover:text-primary-hover transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                Wróć do logowania
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative flex items-center overflow-hidden rounded-lg">
                                <Mail className="absolute left-3 md:left-4 w-4 h-4 md:w-5 md:h-5 text-muted" />
                                <Input
                                    type="email"
                                    placeholder="Adres email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
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
                                        Wyślij link
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
