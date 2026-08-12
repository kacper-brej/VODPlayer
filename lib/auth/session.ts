import "server-only";
import { cache } from "react";
import type { AuthUser } from "@/lib/core/contracts";
import { findUserForLogin } from "@/lib/auth/userRepository";
import { verifyPassword } from "@/lib/auth/passwordHash";
import { consumeLoginRateLimit, deleteOldAuthAttempts } from "@/lib/auth/rateLimit";
import { deleteStaleWriteRateLimits } from "@/lib/http/writeRateLimit";
import { deleteFinishedParties } from "@/lib/party/partyRepository";
import {
    advanceSessionsValidFrom,
    createSession,
    deleteAllSessionsForUser,
    deleteExpiredSessions,
    deleteSession,
    findSessionUser,
} from "@/lib/auth/sessionRepository";
import { clientIp } from "@/lib/auth/clientIp";
import {
    mintSessionCookieValue,
    verifySessionCookieValue,
    setSessionCookie,
    clearSessionCookie,
    readSessionCookieValue,
    SESSION_MAX_AGE_SECONDS,
    SESSION_MAX_AGE_REMEMBERED_SECONDS,
} from "@/lib/auth/sessionCookie";
import { DatabaseError } from "@/lib/db/errors";
import { withTransaction } from "@/lib/db/transaction";

declare global {
    var __nocturnaSessionCleanupAt: number | undefined;
}

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_SWEEP_LIMIT = 500;

export class AuthError extends Error {
    readonly httpStatus: 401 | 403;

    constructor(httpStatus: 401 | 403, message: string) {
        super(message);
        this.name = "AuthError";
        this.httpStatus = httpStatus;
    }
}

export type LoginResult =
    | { ok: true; user: AuthUser }
    | { ok: false; code: "invalid" | "rate_limited" | "server" };

export type LogoutResult = { ok: true } | { ok: false; code: "server" };

export const maybeRunRetentionSweep = async (now = Date.now()): Promise<void> => {
    const lastCleanup = globalThis.__nocturnaSessionCleanupAt ?? 0;
    if (now - lastCleanup < SESSION_CLEANUP_INTERVAL_MS) return;
    globalThis.__nocturnaSessionCleanupAt = now;

    const sweeps: ReadonlyArray<readonly [string, () => Promise<void>]> = [
        ["sessions", () => deleteExpiredSessions(100)],
        ["auth_attempts", () => deleteOldAuthAttempts(RETENTION_SWEEP_LIMIT)],
        ["request_rate_limits", () => deleteStaleWriteRateLimits(RETENTION_SWEEP_LIMIT)],
        ["watch_parties", async () => { await deleteFinishedParties(86_400, 100); }],
    ];

    for (const [table, sweep] of sweeps) {
        try {
            await sweep();
        } catch (error) {
            console.error(`retention sweep: nie udało się wyczyścić ${table}`, error);
        }
    }
};

const establishSession = async (user: AuthUser, rememberMe: boolean): Promise<void> => {
    const maxAgeSeconds = rememberMe ? SESSION_MAX_AGE_REMEMBERED_SECONDS : SESSION_MAX_AGE_SECONDS;
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
    const rawToken = await createSession(user.id, expiresAt);
    const cookieValue = await mintSessionCookieValue(rawToken, maxAgeSeconds);
    await setSessionCookie(cookieValue, maxAgeSeconds);
    await maybeRunRetentionSweep();
};

export const login = async (email: string, password: string, rememberMe: boolean): Promise<LoginResult> => {
    if (!email || email.length > 254 || !password || password.length > 128) return { ok: false, code: "invalid" };

    try {
        const ip = await clientIp();

        if (await consumeLoginRateLimit(ip, email)) {
            return { ok: false, code: "rate_limited" };
        }

        const user = await findUserForLogin(email);
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return { ok: false, code: "invalid" };
        }
        if (!user.emailVerified) return { ok: false, code: "invalid" };

        const authUser: AuthUser = { id: user.id, username: user.username, email: user.email, role: user.role, onboardedAt: user.onboardedAt };
        await establishSession(authUser, rememberMe);

        return { ok: true, user: authUser };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export const createSessionForUser = async (user: AuthUser, rememberMe: boolean): Promise<void> => {
    await establishSession(user, rememberMe);
};

export const logout = async (): Promise<LogoutResult> => {
    const cookieValue = await readSessionCookieValue();

    if (cookieValue) {
        const rawToken = await verifySessionCookieValue(cookieValue);
        if (rawToken) {
            try {
                await deleteSession(rawToken);
            } catch (error) {
                console.error("logout: nie udało się unieważnić sesji po stronie serwera", error);
                return { ok: false, code: "server" };
            }
        }
    }

    await clearSessionCookie();
    return { ok: true };
};

export const getSessionUser = cache(async (): Promise<AuthUser | null> => {
    const cookieValue = await readSessionCookieValue();
    if (!cookieValue) return null;

    const rawToken = await verifySessionCookieValue(cookieValue);
    if (!rawToken) return null;

    try {
        return await findSessionUser(rawToken);
    } catch (error) {
        console.error("getSessionUser: blad bazy przy weryfikacji sesji", error);
        return null;
    }
});

export const requireUser = async (): Promise<AuthUser> => {
    const user = await getSessionUser();
    if (!user) throw new AuthError(401, "Brak autoryzacji.");
    return user;
};

export const requireAdmin = async (): Promise<AuthUser> => {
    const user = await requireUser();
    if (user.role !== "admin") throw new AuthError(403, "Brak uprawnień.");
    return user;
};

export const cleanupSessionsForUser = async (userId: number): Promise<boolean> => {
    try {
        await deleteAllSessionsForUser(userId);
        return true;
    } catch (error) {
        console.error("session cleanup: nie udało się fizycznie usunąć rekordów użytkownika", error);
        return false;
    }
};

export const revokeAllSessions = async (userId: number): Promise<void> => {
    await withTransaction(async (connection) => advanceSessionsValidFrom(userId, connection));
    await cleanupSessionsForUser(userId);
};

export const revokeAllSessionsForUser = revokeAllSessions;
