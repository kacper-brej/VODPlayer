import "server-only";
import { withTransaction } from "@/lib/db/transaction";
import { DatabaseError } from "@/lib/db/errors";
import { generateToken, hashToken } from "@/lib/auth/tokenHash";
import { hashPassword } from "@/lib/auth/passwordHash";
import { consumeLoginRateLimit } from "@/lib/auth/rateLimit";
import { clientIp } from "@/lib/auth/clientIp";
import { cleanupSessionsForUser } from "@/lib/auth/session";
import { sendAccountEmail } from "@/lib/mail/sendMail";
import * as repo from "@/lib/auth/accountRepository";
import { readApplicationUrl } from "@/lib/auth/authConfig";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export type RegisterResult =
    | { ok: true }
    | { ok: false; code: "invalid" | "conflict" | "qr_invalid" | "server" };

export const register = async (
    username: string,
    email: string,
    password: string,
    qrToken: string,
): Promise<RegisterResult> => {
    if (!username || username.length > 50 || !email || email.length > 254 || password.length < 8 || password.length > 128 || qrToken.length > 256) return { ok: false, code: "invalid" };
    if (!isValidEmail(email)) return { ok: false, code: "invalid" };

    const passwordHash = await hashPassword(password);
    const verification = generateToken();
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    try {
        const result = await withTransaction(async (connection) => {
            let qrSessionId: number | null = null;
            if (qrToken) {
                qrSessionId = await repo.lockPendingQrRegisterSession(qrToken, connection);
                if (qrSessionId === null) return { outcome: "qr_invalid" as const };
            }

            const existingId = await repo.findUserIdByEmailOrUsername(email, username, connection);
            if (existingId !== null) return { outcome: "conflict" as const };

            const userId = await repo.insertUser(
                username,
                email,
                passwordHash,
                verification.hash,
                verificationExpiresAt,
                connection,
            );

            if (qrSessionId !== null) {
                await repo.linkQrSessionToUser(qrSessionId, userId, connection);
            }

            return { outcome: "created" as const, userId };
        });

        if (result.outcome === "qr_invalid") return { ok: false, code: "qr_invalid" };
        if (result.outcome === "conflict") return { ok: false, code: "conflict" };

        const sent = await sendAccountEmail({
            to: email,
            subject: "Potwierdź adres email w Nocturnie",
            preheader: "Potwierdź adres, żeby zalogować się do Nocturny.",
            heading: "Witaj w Nocturnie",
            text: "Konto zostało utworzone. Potwierdź adres email, żeby móc się zalogować.",
            note: "Link jest ważny 24 godziny. Jeśli konto zakładał ktoś inny, zignoruj tę wiadomość.",
            buttonLabel: "Potwierdź adres email",
            buttonUrl: `${readApplicationUrl()}/verify?token=${verification.raw}`,
        });
        if (!sent) console.error("register: wysyłka maila weryfikacyjnego nie powiodła się");

        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export const verifyEmail = async (rawToken: string): Promise<"ok" | "invalid"> => {
    if (!rawToken || rawToken.length > 256) return "invalid";
    const tokenHash = hashToken(rawToken);

    try {
        const userId = await withTransaction(async (connection) => {
            const id = await repo.lockUserByVerificationTokenHash(tokenHash, connection);
            if (id === null) return null;
            await repo.markEmailVerified(id, connection);
            await repo.approvePendingQrRegisterSession(id, connection);
            return id;
        });

        return userId === null ? "invalid" : "ok";
    } catch (error) {
        if (error instanceof DatabaseError) return "invalid";
        throw error;
    }
};

export const resendVerification = async (email: string): Promise<void> => {
    if (!email || email.length > 254 || !isValidEmail(email)) return;

    try {
        const ip = await clientIp();
        if (await consumeLoginRateLimit(ip, email)) return;

        const userId = await repo.findUnverifiedUserIdByEmail(email);
        if (userId === null) return;

        const verification = generateToken();
        const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
        await repo.setVerificationToken(userId, verification.hash, expiresAt);

        const sent = await sendAccountEmail({
            to: email,
            subject: "Nowy link do potwierdzenia adresu",
            preheader: "Twój nowy link do potwierdzenia adresu email.",
            heading: "Potwierdź adres email",
            text: "Oto nowy link do potwierdzenia adresu. Poprzedni już nie działa.",
            note: "Link jest ważny 24 godziny.",
            buttonLabel: "Potwierdź adres email",
            buttonUrl: `${readApplicationUrl()}/verify?token=${verification.raw}`,
        });
        if (!sent) console.error("resendVerification: wysyłka nie powiodła się");
    } catch (error) {
        if (!(error instanceof DatabaseError)) throw error;
        console.error("resendVerification: blad bazy", error);
    }
};

export type RequestPasswordResetResult = { ok: true } | { ok: false; code: "invalid" | "rate_limited" | "server" };

export const requestPasswordReset = async (email: string): Promise<RequestPasswordResetResult> => {
    if (!email || email.length > 254 || !isValidEmail(email)) return { ok: false, code: "invalid" };

    try {
        const ip = await clientIp();
        if (await consumeLoginRateLimit(ip, email)) return { ok: false, code: "rate_limited" };

        const userId = await repo.findUserIdByEmail(email);
        if (userId !== null) {
            const reset = generateToken();
            const expiresAt = new Date(Date.now() + RESET_TTL_MS);
            await repo.setResetToken(userId, reset.hash, expiresAt);

            const sent = await sendAccountEmail({
                to: email,
                subject: "Resetowanie hasła w Nocturnie",
                preheader: "Ustaw nowe hasło do konta w Nocturnie.",
                heading: "Zresetuj hasło",
                text: "Ktoś poprosił o zmianę hasła do konta przypisanego do tego adresu.",
                note: "Link jest ważny godzinę. Jeśli to nie Ty, zignoruj tę wiadomość. Hasło zostanie takie samo.",
                buttonLabel: "Ustaw nowe hasło",
                buttonUrl: `${readApplicationUrl()}/reset-password?token=${reset.raw}`,
            });
            if (!sent) console.error("requestPasswordReset: wysyłka nie powiodła się");
        }

        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type ResetPasswordResult = { ok: true } | { ok: false; code: "invalid" | "server" };

export const resetPassword = async (rawToken: string, newPassword: string): Promise<ResetPasswordResult> => {
    if (!rawToken || rawToken.length > 256 || newPassword.length < 8 || newPassword.length > 128) return { ok: false, code: "invalid" };

    const tokenHash = hashToken(rawToken);
    const newPasswordHash = await hashPassword(newPassword);

    try {
        const userId = await withTransaction(async (connection) => {
            const id = await repo.lockUserByResetTokenHash(tokenHash, connection);
            if (id === null) return null;
            await repo.applyPasswordReset(id, newPasswordHash, connection);
            return id;
        });

        if (userId === null) return { ok: false, code: "invalid" };

        await cleanupSessionsForUser(userId);

        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type RequestEmailChangeResult = { ok: true } | { ok: false; code: "invalid" | "conflict" | "server" };

export const requestEmailChange = async (
    userId: number,
    currentEmail: string,
    newEmail: string,
): Promise<RequestEmailChangeResult> => {
    if (!newEmail || !isValidEmail(newEmail)) return { ok: false, code: "invalid" };
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) return { ok: false, code: "conflict" };

    try {
        if (await repo.isEmailTakenByOther(newEmail, userId)) return { ok: false, code: "conflict" };

        const change = generateToken();
        const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
        await repo.setEmailChangeRequest(userId, newEmail, change.hash, expiresAt);

        const sent = await sendAccountEmail({
            to: newEmail,
            subject: "Potwierdź nowy adres email",
            preheader: "Potwierdź zmianę adresu email na koncie Nocturna.",
            heading: "Potwierdź nowy adres",
            text: "Ten adres ma zastąpić dotychczasowy w Twoim koncie Nocturna.",
            note: "Link jest ważny godzinę. Dopóki go nie otworzysz, logujesz się starym adresem. Jeśli to nie Ty, zignoruj tę wiadomość.",
            buttonLabel: "Potwierdź adres",
            buttonUrl: `${readApplicationUrl()}/confirm-email-change?token=${change.raw}`,
        });
        if (!sent) console.error("requestEmailChange: wysyłka nie powiodła się");

        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export const confirmEmailChange = async (rawToken: string): Promise<"ok" | "invalid" | "taken"> => {
    if (!rawToken) return "invalid";
    const tokenHash = hashToken(rawToken);

    let userId: number | null;
    try {
        userId = await withTransaction(async (connection) => {
            const found = await repo.lockUserByEmailChangeTokenHash(tokenHash, connection);
            if (!found) return null;
            await repo.applyEmailChange(found.id, connection);
            return found.id;
        });
    } catch (error) {
        if (error instanceof DatabaseError && error.code === "conflict") return "taken";
        if (error instanceof DatabaseError) return "invalid";
        throw error;
    }

    if (userId === null) return "invalid";

    await cleanupSessionsForUser(userId);

    return "ok";
};
