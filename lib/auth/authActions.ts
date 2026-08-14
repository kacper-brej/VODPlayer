"use server";

import type { AuthUser } from "@/lib/core/contracts";
import { login as loginService, logout as logoutService, getSessionUser, createSessionForUser } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/userRepository";
import * as accountService from "@/lib/auth/accountService";
import * as qrService from "@/lib/auth/qrService";

export type AuthActionResult = {
    ok: boolean;
    message: string;
    code?: "invalid" | "expired" | "rate_limited" | "network" | "server";
    user?: AuthUser;
};

export const loginAction = async (formData: FormData): Promise<AuthActionResult> => {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const rememberMe = formData.get("rememberMe") === "on";

    if (!email || !password) return { ok: false, code: "invalid", message: "Podaj adres email i hasło." };

    const result = await loginService(email, password, rememberMe);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Nieprawidłowy email lub hasło. Sprawdź dane i spróbuj ponownie.",
            rate_limited: "Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.",
            server: "Serwer jest chwilowo niedostępny.",
        };
        return { ok: false, code: result.code, message: messages[result.code] };
    }

    return { ok: true, message: "Zalogowano.", user: result.user };
};

export const logoutAction = async () => logoutService();

export const registerAction = async (formData: FormData): Promise<AuthActionResult> => {
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const qrToken = String(formData.get("qrToken") ?? "").trim();

    if (!username || !email || password.length < 8) {
        return { ok: false, code: "invalid", message: "Uzupełnij wszystkie pola. Hasło musi mieć co najmniej 8 znaków." };
    }
    if (password !== confirmPassword) return { ok: false, code: "invalid", message: "Hasła nie są takie same." };

    const result = await accountService.register(username, email, password, qrToken);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Sprawdź pola formularza i spróbuj ponownie.",
            conflict: "Konto z tym adresem email lub nazwą użytkownika już istnieje.",
            qr_invalid: "Kod rejestracyjny wygasł lub jest nieprawidłowy.",
            server: "Nie udało się utworzyć konta.",
        };
        return { ok: false, code: result.code === "conflict" ? "invalid" : result.code === "qr_invalid" ? "expired" : result.code, message: messages[result.code] };
    }

    return { ok: true, message: "Konto utworzone. Sprawdź skrzynkę i potwierdź adres email." };
};

export const forgotPasswordAction = async (formData: FormData): Promise<AuthActionResult> => {
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return { ok: false, code: "invalid", message: "Podaj poprawny adres email." };

    const result = await accountService.requestPasswordReset(email);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Podaj poprawny adres email.",
            rate_limited: "Zbyt wiele prób. Spróbuj ponownie za chwilę.",
            server: "Serwer jest chwilowo niedostępny.",
        };
        return { ok: false, code: result.code, message: messages[result.code] };
    }

    return { ok: true, message: "Jeśli konto istnieje, link do zmiany hasła został wysłany." };
};

export const resendVerificationAction = async (email: string): Promise<AuthActionResult> => {
    if (!email) return { ok: false, code: "invalid", message: "Najpierw podaj adres email." };

    await accountService.resendVerification(email);

    return { ok: true, message: "Jeśli konto wciąż czeka na potwierdzenie, nowy link został wysłany." };
};

export const resetPasswordAction = async (formData: FormData): Promise<AuthActionResult> => {
    const token = String(formData.get("token") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!token) return { ok: false, code: "expired", message: "Brakuje linku do zmiany hasła lub link jest nieprawidłowy." };
    if (password.length < 8) return { ok: false, code: "invalid", message: "Hasło musi mieć co najmniej 8 znaków." };
    if (password !== confirmPassword) return { ok: false, code: "invalid", message: "Hasła nie są takie same." };

    const result = await accountService.resetPassword(token, password);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Link do zmiany hasła wygasł lub jest nieprawidłowy.",
            server: "Nie udało się zmienić hasła.",
        };
        return { ok: false, code: result.code === "invalid" ? "expired" : result.code, message: messages[result.code] };
    }

    return { ok: true, message: "Hasło zmienione. Możesz się zalogować." };
};

export const getCurrentUserAction = async (): Promise<AuthUser | null> => getSessionUser();

export const createQrSessionAction = async (purpose: "login" | "register" = "login"): Promise<{ token: string; expiresIn: number } | null> => {
    try {
        return await qrService.createQrSession(purpose);
    } catch {
        return null;
    }
};

export type QrCheckResult =
    | { status: "approved"; user: AuthUser }
    | { status: "pending" | "verification" | "expired" | "error" };

export const checkQrSessionAction = async (token: string): Promise<QrCheckResult> => {
    try {
        const outcome = await qrService.checkQrSession(token);

        if (outcome.status === "approved") {
            const user = await findUserById(outcome.userId);
            if (!user) return { status: "error" };

            await createSessionForUser(user, false);
            return { status: "approved", user };
        }

        return { status: outcome.status };
    } catch {
        return { status: "error" };
    }
};

export const approveQrSessionAction = async (token: string): Promise<AuthActionResult> => {
    const user = await getSessionUser();
    if (!user) return { ok: false, code: "invalid", message: "Zaloguj się, zanim zatwierdzisz to urządzenie." };

    const result = await qrService.approveQrSession(token, user.id);

    if (result === "invalid") {
        return { ok: false, code: "expired", message: "Ten kod QR wygasł lub jest nieprawidłowy." };
    }

    return { ok: true, message: "Urządzenie zatwierdzone." };
};
