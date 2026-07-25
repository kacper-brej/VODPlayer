'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock } from 'lucide-react';
import { cn } from "@/lib/utils"

type FeedbackType = 'success' | 'error';

export interface AuthStatusMessageProps {
    status: FeedbackType | null;
    message: string;
}

export function AuthStatusMessage({ status, message }: AuthStatusMessageProps) {
    return (
        <AnimatePresence mode="wait">
            {status && (
                <motion.div
                    key={`${status}-${message}`}
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="overflow-hidden"
                >
                    <div
                        className={cn(
                            "flex items-center gap-3 rounded-lg border px-3 py-2.5 mb-1",
                            status === "success"
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-danger/10 border-danger/30"
                        )}
                    >
                        <motion.div
                            initial={{ scale: 0, rotate: -25 }}
                            animate={
                                status === "error"
                                    ? { scale: 1, rotate: 0, x: [0, -6, 6, -5, 5, -2, 2, 0] }
                                    : { scale: 1, rotate: 0 }
                            }
                            transition={
                                status === "error"
                                    ? {
                                        scale: { type: "spring", stiffness: 500, damping: 15 },
                                        x: { duration: 0.5, delay: 0.1, ease: "easeInOut" },
                                    }
                                    : { type: "spring", stiffness: 500, damping: 15 }
                            }
                            className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                                status === "success" ? "bg-emerald-500/20" : "bg-danger/20"
                            )}
                        >
                            {status === "success" ? (
                                <Unlock className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <Lock className="w-4 h-4 text-danger" />
                            )}
                        </motion.div>
                        <p
                            className={cn(
                                "text-xs md:text-sm font-medium leading-snug",
                                status === "success" ? "text-emerald-400" : "text-danger"
                            )}
                        >
                            {message}
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
