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

    if (!email || !password) return { ok: false, code: "invalid", message: "Enter your email and password." };

    const result = await loginService(email, password, rememberMe);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Incorrect email or password.",
            rate_limited: "Too many attempts. Try again later.",
            server: "The server is temporarily unavailable.",
        };
        return { ok: false, code: result.code, message: messages[result.code] };
    }

    return { ok: true, message: "Signed in successfully.", user: result.user };
};

export const logoutAction = async () => logoutService();

export const registerAction = async (formData: FormData): Promise<AuthActionResult> => {
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const qrToken = String(formData.get("qrToken") ?? "").trim();

    if (!username || !email || password.length < 8) {
        return { ok: false, code: "invalid", message: "Complete all fields and use at least 8 characters for the password." };
    }
    if (password !== confirmPassword) return { ok: false, code: "invalid", message: "Passwords do not match." };

    const result = await accountService.register(username, email, password, qrToken);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Check the form fields and try again.",
            conflict: "An account with this email or username already exists.",
            qr_invalid: "The registration code has expired or is invalid.",
            server: "Could not create the account.",
        };
        return { ok: false, code: result.code === "conflict" ? "invalid" : result.code === "qr_invalid" ? "expired" : result.code, message: messages[result.code] };
    }

    return { ok: true, message: "Account created. Check your inbox to confirm your email address." };
};

export const forgotPasswordAction = async (formData: FormData): Promise<AuthActionResult> => {
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return { ok: false, code: "invalid", message: "Enter a valid email address." };

    const result = await accountService.requestPasswordReset(email);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Enter a valid email address.",
            rate_limited: "Too many attempts. Try again later.",
            server: "The server is temporarily unavailable.",
        };
        return { ok: false, code: result.code, message: messages[result.code] };
    }

    return { ok: true, message: "If the account exists, a password reset link has been sent." };
};

export const resendVerificationAction = async (email: string): Promise<AuthActionResult> => {
    if (!email) return { ok: false, code: "invalid", message: "Enter your email address first." };

    await accountService.resendVerification(email);

    return { ok: true, message: "If the account still requires confirmation, a new link has been sent." };
};

export const resetPasswordAction = async (formData: FormData): Promise<AuthActionResult> => {
    const token = String(formData.get("token") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!token) return { ok: false, code: "expired", message: "The reset link is missing or invalid." };
    if (password.length < 8) return { ok: false, code: "invalid", message: "Use at least 8 characters for the password." };
    if (password !== confirmPassword) return { ok: false, code: "invalid", message: "Passwords do not match." };

    const result = await accountService.resetPassword(token, password);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "The reset link has expired or is invalid.",
            server: "Could not reset the password.",
        };
        return { ok: false, code: result.code === "invalid" ? "expired" : result.code, message: messages[result.code] };
    }

    return { ok: true, message: "Password changed. You can now sign in." };
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
    if (!user) return { ok: false, code: "invalid", message: "Sign in before approving this device." };

    const result = await qrService.approveQrSession(token, user.id);

    if (result === "invalid") {
        return { ok: false, code: "expired", message: "This QR code has expired or is invalid." };
    }

    return { ok: true, message: "Device approved." };
};
