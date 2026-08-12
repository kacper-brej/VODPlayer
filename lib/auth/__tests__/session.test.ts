import { describe, expect, it, vi, beforeEach } from "vitest";

const findUserForLogin = vi.fn();
vi.mock("@/lib/auth/userRepository", () => ({ findUserForLogin }));

const verifyPassword = vi.fn();
vi.mock("@/lib/auth/passwordHash", () => ({ verifyPassword }));

const consumeLoginRateLimit = vi.fn();
const deleteOldAuthAttempts = vi.fn();
vi.mock("@/lib/auth/rateLimit", () => ({ consumeLoginRateLimit, deleteOldAuthAttempts }));

const deleteStaleWriteRateLimits = vi.fn();
vi.mock("@/lib/http/writeRateLimit", () => ({ deleteStaleWriteRateLimits }));

const deleteFinishedParties = vi.fn();
vi.mock("@/lib/party/partyRepository", () => ({ deleteFinishedParties }));

const createSession = vi.fn();
const findSessionUser = vi.fn();
const deleteSession = vi.fn();
const deleteAllSessionsForUser = vi.fn();
const deleteExpiredSessions = vi.fn();
const advanceSessionsValidFrom = vi.fn();
vi.mock("@/lib/auth/sessionRepository", () => ({
    createSession,
    findSessionUser,
    deleteSession,
    deleteAllSessionsForUser,
    deleteExpiredSessions,
    advanceSessionsValidFrom,
}));

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}),
}));

const mintSessionCookieValue = vi.fn(async (raw: string) => `jwt(${raw})`);
const verifySessionCookieValue = vi.fn();
const setSessionCookie = vi.fn();
const clearSessionCookie = vi.fn();
const readSessionCookieValue = vi.fn();
vi.mock("@/lib/auth/sessionCookie", () => ({
    mintSessionCookieValue,
    verifySessionCookieValue,
    setSessionCookie,
    clearSessionCookie,
    readSessionCookieValue,
    SESSION_MAX_AGE_SECONDS: 86400,
    SESSION_MAX_AGE_REMEMBERED_SECONDS: 2592000,
}));

vi.mock("next/headers", () => ({
    headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

const {
    login,
    logout,
    getSessionUser,
    requireUser,
    requireAdmin,
    revokeAllSessions,
    AuthError,
} = await import("../session");

const ADMIN = { id: 1, username: "kacper", email: "k@example.com", role: "admin" as const };
const VIEWER = { id: 2, username: "viewer", email: "v@example.com", role: "viewer" as const };

beforeEach(() => {
    vi.clearAllMocks();
    process.env.TRUSTED_PROXY_HOPS = "1";
    consumeLoginRateLimit.mockResolvedValue(false);
    mintSessionCookieValue.mockImplementation(async (raw: string) => `jwt(${raw})`);
    deleteExpiredSessions.mockResolvedValue(undefined);
    deleteOldAuthAttempts.mockResolvedValue(undefined);
    deleteStaleWriteRateLimits.mockResolvedValue(undefined);
    deleteFinishedParties.mockResolvedValue(0);
    globalThis.__nocturnaSessionCleanupAt = undefined;
});

describe("login", () => {
    it("poprawne dane -> tworzy sesje, ustawia ciasteczko, zwraca usera", async () => {
        findUserForLogin.mockResolvedValue({
            id: ADMIN.id, username: ADMIN.username, email: ADMIN.email,
            passwordHash: "hash", emailVerified: true, role: ADMIN.role,
        });
        verifyPassword.mockResolvedValue(true);
        createSession.mockResolvedValue("raw-token");

        const result = await login("k@example.com", "correct", false);

        expect(result).toEqual({ ok: true, user: ADMIN });
        expect(consumeLoginRateLimit).toHaveBeenCalledWith("203.0.113.7", "k@example.com");
        expect(createSession).toHaveBeenCalledWith(ADMIN.id, expect.any(Date));
        expect(setSessionCookie).toHaveBeenCalledWith("jwt(raw-token)", 86400);
    });

    it("zapamietaj mnie -> dluzszy max-age sesji", async () => {
        findUserForLogin.mockResolvedValue({
            id: ADMIN.id, username: ADMIN.username, email: ADMIN.email,
            passwordHash: "hash", emailVerified: true, role: ADMIN.role,
        });
        verifyPassword.mockResolvedValue(true);
        createSession.mockResolvedValue("raw-token");

        await login("k@example.com", "correct", true);

        expect(setSessionCookie).toHaveBeenCalledWith(expect.any(String), 2592000);
    });

    it("zle haslo -> invalid, sesja nie powstaje", async () => {
        findUserForLogin.mockResolvedValue({
            id: ADMIN.id, username: ADMIN.username, email: ADMIN.email,
            passwordHash: "hash", emailVerified: true, role: ADMIN.role,
        });
        verifyPassword.mockResolvedValue(false);

        await expect(login("k@example.com", "wrong", false)).resolves.toEqual({ ok: false, code: "invalid" });
        expect(createSession).not.toHaveBeenCalled();
    });

    it("nieistniejace konto -> ten sam kod 'invalid' co zle haslo (brak enumeracji)", async () => {
        findUserForLogin.mockResolvedValue(null);

        const result = await login("ghost@example.com", "whatever", false);

        expect(result).toEqual({ ok: false, code: "invalid" });
        expect(verifyPassword).not.toHaveBeenCalled();
    });

    it("niezweryfikowany email -> ten sam neutralny kod co błędne dane", async () => {
        findUserForLogin.mockResolvedValue({
            id: ADMIN.id, username: ADMIN.username, email: ADMIN.email,
            passwordHash: "hash", emailVerified: false, role: ADMIN.role,
        });
        verifyPassword.mockResolvedValue(true);

        await expect(login("k@example.com", "correct", false)).resolves.toEqual({ ok: false, code: "invalid" });
        expect(createSession).not.toHaveBeenCalled();
    });

    it("rate limit -> odrzuca przed dotknieciem hasla/bazy uzytkownikow", async () => {
        consumeLoginRateLimit.mockResolvedValue(true);

        const result = await login("k@example.com", "whatever", false);

        expect(result).toEqual({ ok: false, code: "rate_limited" });
        expect(consumeLoginRateLimit).toHaveBeenCalledOnce();
        expect(findUserForLogin).not.toHaveBeenCalled();
    });

    it("puste pola -> invalid bez dotykania rate limitu", async () => {
        await expect(login("", "", false)).resolves.toEqual({ ok: false, code: "invalid" });
        expect(consumeLoginRateLimit).not.toHaveBeenCalled();
    });
});

describe("logout", () => {
    it("usuwa sesje z bazy i czysci ciasteczko", async () => {
        readSessionCookieValue.mockResolvedValue("jwt-value");
        verifySessionCookieValue.mockResolvedValue("raw-token");

        await expect(logout()).resolves.toEqual({ ok: true });

        expect(deleteSession).toHaveBeenCalledWith("raw-token");
        expect(clearSessionCookie).toHaveBeenCalledOnce();
    });

    it("brak ciasteczka -> mimo to czysci (idempotentne)", async () => {
        readSessionCookieValue.mockResolvedValue(null);

        await expect(logout()).resolves.toEqual({ ok: true });

        expect(deleteSession).not.toHaveBeenCalled();
        expect(clearSessionCookie).toHaveBeenCalledOnce();
    });

    it("awaria DELETE raportuje błąd i pozostawia cookie do bezpiecznego retry", async () => {
        readSessionCookieValue.mockResolvedValue("jwt-value");
        verifySessionCookieValue.mockResolvedValue("raw-token");
        deleteSession.mockRejectedValue(new Error("db unavailable"));

        await expect(logout()).resolves.toEqual({ ok: false, code: "server" });
        expect(clearSessionCookie).not.toHaveBeenCalled();
    });
});

describe("getSessionUser", () => {
    it("brak ciasteczka -> null", async () => {
        readSessionCookieValue.mockResolvedValue(null);
        await expect(getSessionUser()).resolves.toBeNull();
    });

    it("uszkodzony/sfalszowany JWT -> null", async () => {
        readSessionCookieValue.mockResolvedValue("garbage");
        verifySessionCookieValue.mockResolvedValue(null);
        await expect(getSessionUser()).resolves.toBeNull();
        expect(findSessionUser).not.toHaveBeenCalled();
    });

    it("JWT poprawny, ale sesja wygasla/nie istnieje w bazie -> null", async () => {
        readSessionCookieValue.mockResolvedValue("jwt-value");
        verifySessionCookieValue.mockResolvedValue("raw-token");
        findSessionUser.mockResolvedValue(null);

        await expect(getSessionUser()).resolves.toBeNull();
    });

    it("sesja wazna -> zwraca AuthUser", async () => {
        readSessionCookieValue.mockResolvedValue("jwt-value");
        verifySessionCookieValue.mockResolvedValue("raw-token");
        findSessionUser.mockResolvedValue(VIEWER);

        await expect(getSessionUser()).resolves.toEqual(VIEWER);
    });
});

describe("requireUser / requireAdmin", () => {
    it("requireUser rzuca AuthError 401, gdy niezalogowany", async () => {
        readSessionCookieValue.mockResolvedValue(null);
        await expect(requireUser()).rejects.toMatchObject({ httpStatus: 401 });
        await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
    });

    it("requireAdmin rzuca 403 dla roli viewer", async () => {
        readSessionCookieValue.mockResolvedValue("jwt-value");
        verifySessionCookieValue.mockResolvedValue("raw-token");
        findSessionUser.mockResolvedValue(VIEWER);

        await expect(requireAdmin()).rejects.toMatchObject({ httpStatus: 403 });
    });

    it("requireAdmin przechodzi dla roli admin", async () => {
        readSessionCookieValue.mockResolvedValue("jwt-value");
        verifySessionCookieValue.mockResolvedValue("raw-token");
        findSessionUser.mockResolvedValue(ADMIN);

        await expect(requireAdmin()).resolves.toEqual(ADMIN);
    });
});

describe("revokeAllSessions", () => {
    it("najpierw podnosi barierę w transakcji, a DELETE jest tylko cleanupem", async () => {
        deleteAllSessionsForUser.mockRejectedValue(new Error("delete failed"));

        await expect(revokeAllSessions(ADMIN.id)).resolves.toBeUndefined();
        expect(advanceSessionsValidFrom).toHaveBeenCalledWith(ADMIN.id, {});
        expect(deleteAllSessionsForUser).toHaveBeenCalledWith(ADMIN.id);
    });
});

describe("opportunistyczny cleanup", () => {
    it("nie wykonuje DELETE przy każdym logowaniu, tylko najwyżej raz na godzinę procesu", async () => {
        globalThis.__nocturnaSessionCleanupAt = undefined;
        const { maybeRunRetentionSweep } = await import("../session");

        await maybeRunRetentionSweep(10_000_000);
        await maybeRunRetentionSweep(10_000_001);

        expect(deleteExpiredSessions).toHaveBeenCalledTimes(1);
        expect(deleteExpiredSessions).toHaveBeenCalledWith(100);
    });

    it("czyści też auth_attempts i request_rate_limits", async () => {
        globalThis.__nocturnaSessionCleanupAt = undefined;
        const { maybeRunRetentionSweep } = await import("../session");

        await maybeRunRetentionSweep(20_000_000);

        expect(deleteOldAuthAttempts).toHaveBeenCalledWith(500);
        expect(deleteStaleWriteRateLimits).toHaveBeenCalledWith(500);
        expect(deleteFinishedParties).toHaveBeenCalledWith(86_400, 100);
    });

    it("błąd jednego sweepa nie blokuje pozostałych", async () => {
        globalThis.__nocturnaSessionCleanupAt = undefined;
        deleteExpiredSessions.mockRejectedValueOnce(new Error("db down"));
        const { maybeRunRetentionSweep } = await import("../session");

        await expect(maybeRunRetentionSweep(30_000_000)).resolves.toBeUndefined();

        expect(deleteOldAuthAttempts).toHaveBeenCalledTimes(1);
        expect(deleteStaleWriteRateLimits).toHaveBeenCalledTimes(1);
        expect(deleteFinishedParties).toHaveBeenCalledTimes(1);
    });
});
