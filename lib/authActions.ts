"use server";

import { validateMeResponse, type AuthUser } from "@/lib/contracts";
import setSessionCookieAction from "@/lib/setSessionCookieAction";
import { sessionHeaders } from "@/lib/vodConfig";

const AUTH_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AuthActionResult = {
    ok: boolean;
    message: string;
    code?: "invalid" | "unconfirmed" | "expired" | "rate_limited" | "network" | "server";
    user?: AuthUser;
};

const endpoint = (path: string) => `${AUTH_ORIGIN}/${path}`;

const responseMessage = async (response: Response, fallback: string) => {
    const payload: unknown = await response.json().catch(() => null);
    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
        return payload.error;
    }
    if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
        return payload.message;
    }
    return fallback;
};

export const loginAction = async (formData: FormData): Promise<AuthActionResult> => {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const rememberMe = formData.get("rememberMe") === "on";

    if (!email || !password) return { ok: false, code: "invalid", message: "Enter your email and password." };

    try {
        const response = await fetch(endpoint("login.php"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, rememberMe }),
            cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
            const code = response.status === 403
                ? "unconfirmed"
                : response.status === 429
                    ? "rate_limited"
                    : response.status >= 500
                        ? "server"
                        : "invalid";
            const fallback = code === "unconfirmed"
                ? "Confirm your email address before signing in."
                : code === "rate_limited"
                    ? "Too many attempts. Try again later."
                    : "Incorrect email or password.";
            return { ok: false, code, message: await responseMessage(response, fallback) };
        }

        if (!payload || typeof payload !== "object" || !("token" in payload) || typeof payload.token !== "string") {
            return { ok: false, code: "server", message: "The server returned an invalid response." };
        }

        const user = await setSessionCookieAction(payload.token, rememberMe);
        if (!user) return { ok: false, code: "server", message: "The server returned an invalid response." };

        return { ok: true, message: "Signed in successfully.", user };
    } catch {
        return { ok: false, code: "network", message: "Could not connect to the server." };
    }
};

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

    try {
        const response = await fetch(endpoint("register.php"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password, qrToken }),
            cache: "no-store",
        });
        if (!response.ok) {
            const code = response.status === 429 ? "rate_limited" : response.status >= 500 ? "server" : "invalid";
            const message = response.status === 400
                ? "The registration code has expired or is invalid."
                : response.status === 409
                    ? "An account with this email or username already exists."
                    : response.status === 422
                        ? "Check the form fields and try again."
                        : response.status === 429
                            ? "Too many attempts. Try again later."
                            : "Could not create the account.";
            return { ok: false, code, message };
        }
        return { ok: true, message: "Account created. Check your inbox to confirm your email address." };
    } catch {
        return { ok: false, code: "network", message: "Could not connect to the server." };
    }
};

export const forgotPasswordAction = async (formData: FormData): Promise<AuthActionResult> => {
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return { ok: false, code: "invalid", message: "Enter a valid email address." };
    const neutral = "If the account exists, a password reset link has been sent.";

    try {
        const response = await fetch(endpoint("forgot-password.php"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
            cache: "no-store",
        });
        if (response.status === 429) return { ok: false, code: "rate_limited", message: "Too many attempts. Try again later." };
        if (response.status >= 500) return { ok: false, code: "server", message: "The server is temporarily unavailable." };
        return { ok: true, message: neutral };
    } catch {
        return { ok: false, code: "network", message: "Could not connect to the server." };
    }
};

export const resendVerificationAction = async (email: string): Promise<AuthActionResult> => {
    const neutral = "If the account still requires confirmation, a new link has been sent.";
    if (!email) return { ok: false, code: "invalid", message: "Enter your email address first." };

    try {
        const response = await fetch(endpoint("resend-verification.php"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
            cache: "no-store",
        });
        if (response.status === 429) return { ok: false, code: "rate_limited", message: "Too many attempts. Try again later." };
        if (!response.ok) return { ok: false, code: "server", message: "Could not send a new confirmation link." };
        return { ok: true, message: neutral };
    } catch {
        return { ok: false, code: "network", message: "Could not connect to the server." };
    }
};

export const resetPasswordAction = async (formData: FormData): Promise<AuthActionResult> => {
    const token = String(formData.get("token") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!token) return { ok: false, code: "expired", message: "The reset link is missing or invalid." };
    if (password.length < 8) return { ok: false, code: "invalid", message: "Use at least 8 characters for the password." };
    if (password !== confirmPassword) return { ok: false, code: "invalid", message: "Passwords do not match." };

    try {
        const response = await fetch(endpoint("reset-password.php"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
            cache: "no-store",
        });
        if (!response.ok) {
            const code = response.status === 400 ? "expired" : response.status === 429 ? "rate_limited" : response.status >= 500 ? "server" : "invalid";
            return { ok: false, code, message: await responseMessage(response, code === "expired" ? "The reset link has expired or is invalid." : "Could not reset the password.") };
        }
        return { ok: true, message: "Password changed. You can now sign in." };
    } catch {
        return { ok: false, code: "network", message: "Could not connect to the server." };
    }
};

export const getCurrentUserAction = async (): Promise<AuthUser | null> => {
    const headers = await sessionHeaders();
    if (!headers) return null;

    try {
        const response = await fetch(endpoint("me.php"), { headers, cache: "no-store" });
        if (!response.ok) return null;
        const result = validateMeResponse(await response.json());
        return result.ok ? result.data.user : null;
    } catch {
        return null;
    }
};

export const createQrSessionAction = async (purpose: "login" | "register" = "login"): Promise<{ token: string; expiresIn: number } | null> => {
    try {
        const response = await fetch(endpoint("qr-create.php"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ purpose }),
            cache: "no-store",
        });
        const payload: unknown = await response.json();
        if (!response.ok || !payload || typeof payload !== "object") return null;
        if (!("token" in payload) || typeof payload.token !== "string") return null;
        if (!("expiresIn" in payload) || typeof payload.expiresIn !== "number") return null;
        return { token: payload.token, expiresIn: payload.expiresIn };
    } catch {
        return null;
    }
};

export type QrCheckResult =
    | { status: "approved"; user: AuthUser }
    | { status: "pending" | "verification" | "expired" | "error" };

export const checkQrSessionAction = async (token: string): Promise<QrCheckResult> => {
    try {
        const response = await fetch(`${endpoint("qr-check.php")}?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const payload: unknown = await response.json();
        if (!response.ok || !payload || typeof payload !== "object" || !("status" in payload)) return { status: "error" };
        if (payload.status === "approved" && "token" in payload && typeof payload.token === "string") {
            const user = await setSessionCookieAction(payload.token, false);
            if (!user) return { status: "error" };
            return { status: "approved", user };
        }
        if (payload.status === "verification") return { status: "verification" };
        return { status: payload.status === "expired" ? "expired" : "pending" };
    } catch {
        return { status: "error" };
    }
};

export const approveQrSessionAction = async (token: string): Promise<AuthActionResult> => {
    const headers = await sessionHeaders();
    if (!headers) return { ok: false, code: "invalid", message: "Sign in before approving this device." };

    try {
        const response = await fetch(endpoint("qr-approve.php"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ token }),
            cache: "no-store",
        });
        if (!response.ok) return { ok: false, code: response.status === 400 ? "expired" : "server", message: await responseMessage(response, "Could not approve this device.") };
        return { ok: true, message: "Device approved." };
    } catch {
        return { ok: false, code: "network", message: "Could not connect to the server." };
    }
};
