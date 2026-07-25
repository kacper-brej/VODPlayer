'use client'
import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Tv, Mail, Lock, Eye, EyeClosed, ArrowRight, QrCode, Check } from 'lucide-react';
import { cn } from "@/lib/utils"
import { AuthStatusMessage } from "@/components/auth/AuthStatusMessage";
import { QrLoginPanel } from "@/components/auth/QrLoginPanel";
import {useRouter, useSearchParams} from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "file:text-foreground placeholder:text-muted selection:bg-primary selection:text-background border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-primary focus-visible:ring-primary/40 focus-visible:ring-[3px]",
                "aria-invalid:ring-danger/20 aria-invalid:border-danger",
                className
            )}
            {...props}
        />
    )
}

export function SignInCard() {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState("");
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(false);
    const [qrMode, setQrMode] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const verified = searchParams.get('verified');
    const { refreshUser } = useAuth();

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const rotateX = useTransform(mouseY, [-300, 300], [4, -4]);
    const rotateY = useTransform(mouseX, [-300, 300], [-4, 4]);

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left - rect.width / 2);
        mouseY.set(e.clientY - rect.top - rect.height / 2);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
    };

    // TODO: podpiąć docelową logikę logowania (middleware / sesja)
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setStatus('loading');
        setStatusMessage("");

        try{
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login.php`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({email, password, rememberMe}),

            });

            if (res.ok){
                await refreshUser();
                setStatus('success');
                setStatusMessage('Zalogowano pomyślnie. Przekierowujemy…');
                setTimeout(() => {
                    router.push("/");
                }, 800);
                return;
            }

            let errorMessage = 'Błędne dane logowania.';
            try {
                const data = await res.json();
                errorMessage = data.error ?? errorMessage;
            } catch {
                // odpowiedź serwera nie była poprawnym JSON-em, zostaje komunikat domyślny
            }
            setStatus('error');
            setStatusMessage(errorMessage);
        } catch (error) {
            console.log(error);
            setStatus('error');
            setStatusMessage('Błąd połączenia z serwerem.');
        }
    };

    return (
        <div className="min-h-screen w-full bg-background relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/25 via-surface to-background" />

            <div className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
                 style={{
                     backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                     backgroundSize: '200px 200px'
                 }}
            />

            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[120vh] h-[60vh] rounded-b-[50%] bg-primary/20 blur-[80px]" />
            <motion.div
                className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[100vh] h-[60vh] rounded-b-full bg-primary/20 blur-[60px]"
                animate={{
                    opacity: [0.15, 0.25, 0.15],
                    scale: [0.99, 1.01, 0.99]
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    repeatType: "mirror"
                }}
            />
            <motion.div
                className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-[90vh] h-[90vh] rounded-t-full bg-accent/10 blur-[60px]"
                animate={{
                    opacity: [0.3, 0.4, 0.3],
                    scale: [1, 1.05, 1]
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1
                }}
            />

            <div className="absolute left-1/4 top-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse opacity-40" />
            <div className="absolute right-1/4 bottom-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px] animate-pulse delay-1000 opacity-40" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-10 px-4"
                style={{ perspective: 1500 }}
            >
                <motion.div
                    className="relative"
                    style={{ rotateX, rotateY }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    whileHover={{ z: 10 }}
                >
                    <div className="relative group">
                        <motion.div
                            className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-700"
                            animate={{
                                boxShadow: [
                                    "0 0 8px 1px var(--glow-primary)",
                                    "0 0 12px 3px var(--glow-primary)",
                                    "0 0 8px 1px var(--glow-primary)"
                                ],
                                opacity: [0.12, 0.22, 0.12]
                            }}
                            transition={{
                                duration: 5,
                                repeat: Infinity,
                                ease: "easeInOut",
                                repeatType: "mirror"
                            }}
                        />

                        <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
                            <motion.div
                                className="absolute top-0 left-0 h-[2px] w-[35%] bg-gradient-to-r from-transparent via-primary to-transparent"
                                initial={{ filter: "blur(1.5px)" }}
                                animate={{
                                    left: ["-35%", "100%"],
                                    opacity: [0.12, 0.28, 0.12],
                                }}
                                transition={{
                                    left: { duration: 3.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.5 },
                                    opacity: { duration: 1.8, repeat: Infinity, repeatType: "mirror" },
                                }}
                            />

                            <motion.div
                                className="absolute top-0 right-0 h-[35%] w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent"
                                initial={{ filter: "blur(1.5px)" }}
                                animate={{
                                    top: ["-35%", "100%"],
                                    opacity: [0.12, 0.28, 0.12],
                                }}
                                transition={{
                                    top: { duration: 3.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.5, delay: 0.9 },
                                    opacity: { duration: 1.8, repeat: Infinity, repeatType: "mirror", delay: 0.9 },
                                }}
                            />

                            <motion.div
                                className="absolute bottom-0 right-0 h-[2px] w-[35%] bg-gradient-to-r from-transparent via-primary to-transparent"
                                initial={{ filter: "blur(1.5px)" }}
                                animate={{
                                    right: ["-35%", "100%"],
                                    opacity: [0.12, 0.28, 0.12],
                                }}
                                transition={{
                                    right: { duration: 3.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.5, delay: 1.8 },
                                    opacity: { duration: 1.8, repeat: Infinity, repeatType: "mirror", delay: 1.8 },
                                }}
                            />

                            <motion.div
                                className="absolute bottom-0 left-0 h-[35%] w-[2px] bg-gradient-to-b from-transparent via-primary to-transparent"
                                initial={{ filter: "blur(1.5px)" }}
                                animate={{
                                    bottom: ["-35%", "100%"],
                                    opacity: [0.12, 0.28, 0.12],
                                }}
                                transition={{
                                    bottom: { duration: 3.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.5, delay: 2.7 },
                                    opacity: { duration: 1.8, repeat: Infinity, repeatType: "mirror", delay: 2.7 },
                                }}
                            />

                            <motion.div
                                className="absolute top-0 left-0 h-[5px] w-[5px] rounded-full bg-primary/50 blur-[1px]"
                                animate={{ opacity: [0.12, 0.24, 0.12] }}
                                transition={{ duration: 3, repeat: Infinity, repeatType: "mirror" }}
                            />
                            <motion.div
                                className="absolute top-0 right-0 h-[8px] w-[8px] rounded-full bg-primary/70 blur-[2px]"
                                animate={{ opacity: [0.12, 0.24, 0.12] }}
                                transition={{ duration: 3.4, repeat: Infinity, repeatType: "mirror", delay: 0.5 }}
                            />
                            <motion.div
                                className="absolute bottom-0 right-0 h-[8px] w-[8px] rounded-full bg-primary/70 blur-[2px]"
                                animate={{ opacity: [0.12, 0.24, 0.12] }}
                                transition={{ duration: 3.2, repeat: Infinity, repeatType: "mirror", delay: 1 }}
                            />
                            <motion.div
                                className="absolute bottom-0 left-0 h-[5px] w-[5px] rounded-full bg-primary/50 blur-[1px]"
                                animate={{ opacity: [0.12, 0.24, 0.12] }}
                                transition={{ duration: 3.3, repeat: Infinity, repeatType: "mirror", delay: 1.5 }}
                            />
                        </div>

                        <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-primary/10 via-white/5 to-primary/10 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />

                        <div className="relative bg-surface/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 lg:p-10 border border-white/[0.05] shadow-2xl overflow-hidden">
                            <div className="absolute inset-0 opacity-[0.03]"
                                 style={{
                                     backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
                                     backgroundSize: '30px 30px'
                                 }}
                            />

                            <div className="text-center space-y-1 md:space-y-2 mb-5 md:mb-7">
                                <motion.div
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", duration: 0.8 }}
                                    className="mx-auto w-11 h-11 md:w-14 md:h-14 rounded-xl bg-primary/20 flex items-center justify-center relative overflow-hidden"
                                >
                                    <Tv className="text-primary w-5.5 h-5.5 md:w-7 md:h-7" />
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                                </motion.div>

                                <motion.h1
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-xl md:text-2xl lg:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/80"
                                >
                                    Witaj ponownie
                                </motion.h1>

                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-muted text-xs md:text-sm"
                                >
                                    Zaloguj się, aby kontynuować w Nocturna
                                </motion.p>
                            </div>

                            {verified === '1' && (
                                <p className="text-center text-xs md:text-sm text-primary mb-4">
                                    Email potwierdzony — możesz się teraz zalogować.
                                </p>
                            )}
                            {verified === '0' && (
                                <p className="text-center text-xs md:text-sm text-danger mb-4">
                                    Link weryfikacyjny jest nieprawidłowy lub wygasł.
                                </p>
                            )}

                            {qrMode ? (
                                <QrLoginPanel onBack={() => setQrMode(false)} />
                            ) : (
                            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
                                <motion.div className="space-y-3 md:space-y-4">
                                    <motion.div
                                        className={`relative ${focusedInput === "email" ? 'z-10' : ''}`}
                                        whileHover={{ scale: 1.01 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    >
                                        <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/10 via-white/5 to-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />

                                        <div className="relative flex items-center overflow-hidden rounded-lg">
                                            <Mail className={`absolute left-3 md:left-4 w-4 h-4 md:w-5 md:h-5 transition-all duration-300 ${
                                                focusedInput === "email" ? 'text-primary' : 'text-muted'
                                            }`} />

                                            <Input
                                                type="email"
                                                placeholder="Adres email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                onFocus={() => setFocusedInput("email")}
                                                onBlur={() => setFocusedInput(null)}
                                                required
                                                className="w-full bg-surface-light/50 border-transparent focus:border-primary/40 text-foreground placeholder:text-muted h-10 md:h-12 transition-all duration-300 pl-10 md:pl-12 pr-3 md:text-base focus:bg-surface-light"
                                            />

                                            {focusedInput === "email" && (
                                                <motion.div
                                                    layoutId="input-highlight"
                                                    className="absolute inset-0 bg-primary/5 -z-10"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                />
                                            )}
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        className={`relative ${focusedInput === "password" ? 'z-10' : ''}`}
                                        whileHover={{ scale: 1.01 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    >
                                        <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/10 via-white/5 to-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />

                                        <div className="relative flex items-center overflow-hidden rounded-lg">
                                            <Lock className={`absolute left-3 md:left-4 w-4 h-4 md:w-5 md:h-5 transition-all duration-300 ${
                                                focusedInput === "password" ? 'text-primary' : 'text-muted'
                                            }`} />

                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Hasło"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onFocus={() => setFocusedInput("password")}
                                                onBlur={() => setFocusedInput(null)}
                                                required
                                                className="w-full bg-surface-light/50 border-transparent focus:border-primary/40 text-foreground placeholder:text-muted h-10 md:h-12 transition-all duration-300 pl-10 md:pl-12 pr-10 md:pr-12 md:text-base focus:bg-surface-light"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 md:right-4 cursor-pointer"
                                            >
                                                {showPassword ? (
                                                    <Eye className="w-4 h-4 md:w-5 md:h-5 text-muted hover:text-foreground transition-colors duration-300" />
                                                ) : (
                                                    <EyeClosed className="w-4 h-4 md:w-5 md:h-5 text-muted hover:text-foreground transition-colors duration-300" />
                                                )}
                                            </button>

                                            {focusedInput === "password" && (
                                                <motion.div
                                                    layoutId="input-highlight"
                                                    className="absolute inset-0 bg-primary/5 -z-10"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                />
                                            )}
                                        </div>
                                    </motion.div>
                                </motion.div>

                                <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center space-x-2">
                                        <div className="relative">
                                            <input
                                                id="remember-me"
                                                name="remember-me"
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={() => setRememberMe(!rememberMe)}
                                                className="appearance-none h-4 w-4 md:h-5 md:w-5 rounded border border-border bg-surface-light checked:bg-primary checked:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200"
                                            />
                                            <AnimatePresence>
                                                {rememberMe && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
                                                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                                        exit={{ opacity: 0, scale: 0.4 }}
                                                        transition={{ type: "spring", stiffness: 450, damping: 20 }}
                                                        className="absolute inset-0 flex items-center justify-center text-background pointer-events-none"
                                                    >
                                                        <Check className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={3} />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        <label htmlFor="remember-me" className="text-xs md:text-sm text-muted hover:text-foreground transition-colors duration-200">
                                            Zapamiętaj mnie
                                        </label>
                                    </div>

                                    <div className="text-xs md:text-sm relative group/link">
                                        <Link href="/forgot-password" className="text-muted hover:text-primary transition-colors duration-200">
                                            Zapomniałeś hasła?
                                        </Link>
                                    </div>
                                </div>

                                <AuthStatusMessage status={status === 'success' || status === 'error' ? status : null} message={statusMessage} />

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={status === 'loading' || status === 'success'}
                                    className="w-full relative group/button mt-5 md:mt-6"
                                >
                                    <div className="absolute inset-0 bg-primary/30 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />

                                    <div className="relative overflow-hidden bg-primary text-background font-bold h-10 md:h-12 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg shadow-primary/25">
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 -z-10"
                                            animate={{ x: ['-100%', '100%'] }}
                                            transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
                                            style={{ opacity: status === 'loading' ? 1 : 0, transition: 'opacity 0.3s ease' }}
                                        />

                                        <AnimatePresence mode="wait">
                                            {status === 'loading' ? (
                                                <motion.div
                                                    key="loading"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="flex items-center justify-center"
                                                >
                                                    <div className="w-4 h-4 border-2 border-background/70 border-t-transparent rounded-full animate-spin" />
                                                </motion.div>
                                            ) : (
                                                <motion.span
                                                    key="button-text"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="flex items-center justify-center gap-1 text-sm md:text-base font-medium"
                                                >
                                                    Zaloguj się
                                                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4 group-hover/button:translate-x-1 transition-transform duration-300" />
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.button>

                                <div className="relative mt-2 mb-5 md:mb-6 flex items-center">
                                    <div className="flex-grow border-t border-white/5"></div>
                                    <motion.span
                                        className="mx-3 text-xs md:text-sm text-muted"
                                        initial={{ opacity: 0.7 }}
                                        animate={{ opacity: [0.7, 0.85, 0.7] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        lub
                                    </motion.span>
                                    <div className="flex-grow border-t border-white/5"></div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="button"
                                    onClick={() => setQrMode(true)}
                                    className="w-full relative group/qr"
                                >
                                    <div className="absolute inset-0 bg-primary/5 rounded-lg blur opacity-0 group-hover/qr:opacity-70 transition-opacity duration-300" />

                                    <div className="relative overflow-hidden bg-surface-light/50 text-foreground font-medium h-10 md:h-12 rounded-lg border border-border hover:border-primary/40 transition-all duration-300 flex items-center justify-center gap-2">
                                        <QrCode className="w-4 h-4 md:w-5 md:h-5 text-muted group-hover/qr:text-foreground transition-colors duration-300" />

                                        <span className="text-muted group-hover/qr:text-foreground transition-colors text-xs md:text-sm">
                                            Zaloguj się przez kod QR
                                        </span>

                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0"
                                            initial={{ x: '-100%' }}
                                            whileHover={{ x: '100%' }}
                                            transition={{ duration: 1, ease: "easeInOut" }}
                                        />
                                    </div>
                                </motion.button>

                                <motion.p
                                    className="text-center text-xs md:text-sm text-muted mt-4 md:mt-5"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                >
                                    Nie masz konta?{' '}
                                    <Link href="/signup" className="relative inline-block group/signup">
                                        <span className="relative z-10 text-primary group-hover/signup:text-primary-hover transition-colors duration-300 font-medium">
                                            Zarejestruj się
                                        </span>
                                        <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-primary group-hover/signup:w-full transition-all duration-300" />
                                    </Link>
                                </motion.p>
                            </form>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
