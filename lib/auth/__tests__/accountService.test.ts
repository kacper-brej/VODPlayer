import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}),
}));

const repo = {
    lockPendingQrRegisterSession: vi.fn(),
    findUserIdByEmailOrUsername: vi.fn(),
    insertUser: vi.fn(),
    linkQrSessionToUser: vi.fn(),
    lockUserByVerificationTokenHash: vi.fn(),
    markEmailVerified: vi.fn(),
    approvePendingQrRegisterSession: vi.fn(),
    findUnverifiedUserIdByEmail: vi.fn(),
    setVerificationToken: vi.fn(),
    findUserIdByEmail: vi.fn(),
    setResetToken: vi.fn(),
    lockUserByResetTokenHash: vi.fn(),
    applyPasswordReset: vi.fn(),
    isEmailTakenByOther: vi.fn(),
    setEmailChangeRequest: vi.fn(),
    lockUserByEmailChangeTokenHash: vi.fn(),
    applyEmailChange: vi.fn(),
};
vi.mock("@/lib/auth/accountRepository", () => repo);

const hashPassword = vi.fn(async (plain: string) => `hashed(${plain})`);
vi.mock("@/lib/auth/passwordHash", () => ({ hashPassword, verifyPassword: vi.fn() }));

const consumeLoginRateLimit = vi.fn();
vi.mock("@/lib/auth/rateLimit", () => ({ consumeLoginRateLimit }));

vi.mock("@/lib/auth/clientIp", () => ({ clientIp: async () => "203.0.113.7" }));

const cleanupSessionsForUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ cleanupSessionsForUser }));

const sendAccountEmail = vi.fn(async () => true);
vi.mock("@/lib/mail/sendMail", () => ({ sendAccountEmail }));

const {
    register,
    verifyEmail,
    resendVerification,
    requestPasswordReset,
    resetPassword,
    requestEmailChange,
    confirmEmailChange,
} = await import("../accountService");
const { DatabaseError } = await import("@/lib/db/errors");

beforeEach(() => {
    vi.clearAllMocks();
    consumeLoginRateLimit.mockResolvedValue(false);
    sendAccountEmail.mockResolvedValue(true);
    hashPassword.mockImplementation(async (plain: string) => `hashed(${plain})`);
    cleanupSessionsForUser.mockResolvedValue(true);
});

describe("register", () => {
    it("sukces bez QR: tworzy usera, wysyla mail weryfikacyjny", async () => {
        repo.findUserIdByEmailOrUsername.mockResolvedValue(null);
        repo.insertUser.mockResolvedValue(1);

        const result = await register("kacper", "k@example.com", "correcthorse", "");

        expect(result).toEqual({ ok: true });
        expect(repo.insertUser).toHaveBeenCalledWith(
            "kacper", "k@example.com", "hashed(correcthorse)",
            expect.stringMatching(/^[0-9a-f]{64}$/), expect.any(Date), {},
        );
        expect(repo.linkQrSessionToUser).not.toHaveBeenCalled();
        expect(sendAccountEmail).toHaveBeenCalledOnce();
    });

    it("konflikt email/username -> conflict, brak insertu", async () => {
        repo.findUserIdByEmailOrUsername.mockResolvedValue(99);

        await expect(register("kacper", "k@example.com", "correcthorse", "")).resolves.toEqual({
            ok: false, code: "conflict",
        });
        expect(repo.insertUser).not.toHaveBeenCalled();
        expect(sendAccountEmail).not.toHaveBeenCalled();
    });

    it("QR token nieprawidlowy/wygasly -> qr_invalid, brak insertu", async () => {
        repo.lockPendingQrRegisterSession.mockResolvedValue(null);

        await expect(register("kacper", "k@example.com", "correcthorse", "qr-tok")).resolves.toEqual({
            ok: false, code: "qr_invalid",
        });
        expect(repo.insertUser).not.toHaveBeenCalled();
    });

    it("QR token poprawny -> laczy sesje QR z nowym userem", async () => {
        repo.lockPendingQrRegisterSession.mockResolvedValue(555);
        repo.findUserIdByEmailOrUsername.mockResolvedValue(null);
        repo.insertUser.mockResolvedValue(7);

        await register("kacper", "k@example.com", "correcthorse", "qr-tok");

        expect(repo.linkQrSessionToUser).toHaveBeenCalledWith(555, 7, {});
    });

    it("za krotkie haslo -> invalid bez dotykania bazy", async () => {
        await expect(register("kacper", "k@example.com", "short", "")).resolves.toEqual({
            ok: false, code: "invalid",
        });
        expect(repo.findUserIdByEmailOrUsername).not.toHaveBeenCalled();
    });

    it("nieprawidlowy email -> invalid", async () => {
        await expect(register("kacper", "not-an-email", "correcthorse", "")).resolves.toEqual({
            ok: false, code: "invalid",
        });
    });
});

describe("verifyEmail", () => {
    it("prawidlowy token -> ok, weryfikuje i aprobuje QR", async () => {
        repo.lockUserByVerificationTokenHash.mockResolvedValue(3);

        await expect(verifyEmail("raw-token")).resolves.toBe("ok");
        expect(repo.markEmailVerified).toHaveBeenCalledWith(3, {});
        expect(repo.approvePendingQrRegisterSession).toHaveBeenCalledWith(3, {});
    });

    it("wygasly/nieznany token -> invalid, brak zmian", async () => {
        repo.lockUserByVerificationTokenHash.mockResolvedValue(null);

        await expect(verifyEmail("raw-token")).resolves.toBe("invalid");
        expect(repo.markEmailVerified).not.toHaveBeenCalled();
    });

    it("ponowne uzycie tego samego tokenu po zuzyciu -> invalid (token juz wyczyszczony w bazie)", async () => {
        repo.lockUserByVerificationTokenHash.mockResolvedValueOnce(3).mockResolvedValueOnce(null);

        await expect(verifyEmail("raw-token")).resolves.toBe("ok");
        await expect(verifyEmail("raw-token")).resolves.toBe("invalid");
    });

    it("pusty token -> invalid bez zapytania do bazy", async () => {
        await expect(verifyEmail("")).resolves.toBe("invalid");
        expect(repo.lockUserByVerificationTokenHash).not.toHaveBeenCalled();
    });
});

describe("resendVerification", () => {
    it("niezweryfikowany istniejacy user -> nowy token + mail", async () => {
        repo.findUnverifiedUserIdByEmail.mockResolvedValue(9);

        await resendVerification("k@example.com");

        expect(repo.setVerificationToken).toHaveBeenCalledWith(9, expect.any(String), expect.any(Date));
        expect(sendAccountEmail).toHaveBeenCalledOnce();
    });

    it("rate limit (SEC-21) -> nie dotyka bazy userow ani nie wysyla maila", async () => {
        consumeLoginRateLimit.mockResolvedValue(true);

        await resendVerification("k@example.com");

        expect(repo.findUnverifiedUserIdByEmail).not.toHaveBeenCalled();
        expect(sendAccountEmail).not.toHaveBeenCalled();
    });

    it("nieistniejacy albo juz zweryfikowany user -> cisza, brak maila (neutralnosc)", async () => {
        repo.findUnverifiedUserIdByEmail.mockResolvedValue(null);

        await resendVerification("ghost@example.com");

        expect(repo.setVerificationToken).not.toHaveBeenCalled();
        expect(sendAccountEmail).not.toHaveBeenCalled();
    });
});

describe("requestPasswordReset", () => {
    it("rate limit -> rate_limited, zero dotkniecia bazy userow", async () => {
        consumeLoginRateLimit.mockResolvedValue(true);

        await expect(requestPasswordReset("k@example.com")).resolves.toEqual({ ok: false, code: "rate_limited" });
        expect(repo.findUserIdByEmail).not.toHaveBeenCalled();
    });

    it("istniejace konto -> token zapisany, mail wyslany, neutralna odpowiedz ok:true", async () => {
        repo.findUserIdByEmail.mockResolvedValue(4);

        await expect(requestPasswordReset("k@example.com")).resolves.toEqual({ ok: true });
        expect(repo.setResetToken).toHaveBeenCalledWith(4, expect.any(String), expect.any(Date));
        expect(sendAccountEmail).toHaveBeenCalledOnce();
    });

    it("nieistniejace konto -> ta sama neutralna odpowiedz ok:true, bez maila (brak enumeracji)", async () => {
        repo.findUserIdByEmail.mockResolvedValue(null);

        await expect(requestPasswordReset("ghost@example.com")).resolves.toEqual({ ok: true });
        expect(sendAccountEmail).not.toHaveBeenCalled();
    });

    it("nieprawidlowy email -> invalid", async () => {
        await expect(requestPasswordReset("not-an-email")).resolves.toEqual({ ok: false, code: "invalid" });
    });
});

describe("resetPassword", () => {
    it("prawidlowy token -> zmienia haslo i uniewaznia wszystkie sesje TS", async () => {
        repo.lockUserByResetTokenHash.mockResolvedValue(11);

        await expect(resetPassword("raw-token", "newpassword")).resolves.toEqual({ ok: true });
        expect(repo.applyPasswordReset).toHaveBeenCalledWith(11, "hashed(newpassword)", {});
        expect(cleanupSessionsForUser).toHaveBeenCalledWith(11);
    });

    it("wygasly/nieznany token -> invalid, sesje nietkniete", async () => {
        repo.lockUserByResetTokenHash.mockResolvedValue(null);

        await expect(resetPassword("raw-token", "newpassword")).resolves.toEqual({ ok: false, code: "invalid" });
        expect(cleanupSessionsForUser).not.toHaveBeenCalled();
    });

    it("ponowne uzycie zuzytego tokenu -> invalid", async () => {
        repo.lockUserByResetTokenHash.mockResolvedValueOnce(11).mockResolvedValueOnce(null);

        await expect(resetPassword("raw-token", "newpassword")).resolves.toEqual({ ok: true });
        await expect(resetPassword("raw-token", "newpassword")).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("za krotkie nowe haslo -> invalid bez dotykania bazy", async () => {
        await expect(resetPassword("raw-token", "short")).resolves.toEqual({ ok: false, code: "invalid" });
        expect(repo.lockUserByResetTokenHash).not.toHaveBeenCalled();
    });

    it("awaria fizycznego DELETE nie zachowuje dostępu, bo bariera została podniesiona w transakcji", async () => {
        repo.lockUserByResetTokenHash.mockResolvedValue(11);
        cleanupSessionsForUser.mockResolvedValueOnce(false);

        await expect(resetPassword("raw-token", "newpassword")).resolves.toEqual({ ok: true });
        expect(repo.applyPasswordReset).toHaveBeenCalledWith(11, "hashed(newpassword)", {});
    });
});

describe("requestEmailChange", () => {
    it("sukces -> zapisuje pending_email + token, wysyla mail na NOWY adres", async () => {
        repo.isEmailTakenByOther.mockResolvedValue(false);

        await expect(requestEmailChange(1, "old@example.com", "new@example.com")).resolves.toEqual({ ok: true });
        expect(repo.setEmailChangeRequest).toHaveBeenCalledWith(1, "new@example.com", expect.any(String), expect.any(Date));
        expect(sendAccountEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "new@example.com" }));
    });

    it("identyczny z obecnym adresem -> conflict", async () => {
        await expect(requestEmailChange(1, "same@example.com", "same@example.com")).resolves.toEqual({
            ok: false, code: "conflict",
        });
        expect(repo.isEmailTakenByOther).not.toHaveBeenCalled();
    });

    it("zajety przez innego usera -> conflict", async () => {
        repo.isEmailTakenByOther.mockResolvedValue(true);

        await expect(requestEmailChange(1, "old@example.com", "taken@example.com")).resolves.toEqual({
            ok: false, code: "conflict",
        });
        expect(repo.setEmailChangeRequest).not.toHaveBeenCalled();
    });
});

describe("confirmEmailChange", () => {
    it("prawidlowy token -> ok, zmienia email i uniewaznia sesje", async () => {
        repo.lockUserByEmailChangeTokenHash.mockResolvedValue({ id: 2, pendingEmail: "new@example.com" });

        await expect(confirmEmailChange("raw-token")).resolves.toBe("ok");
        expect(repo.applyEmailChange).toHaveBeenCalledWith(2, {});
        expect(cleanupSessionsForUser).toHaveBeenCalledWith(2);
    });

    it("wygasly/nieznany token -> invalid", async () => {
        repo.lockUserByEmailChangeTokenHash.mockResolvedValue(null);

        await expect(confirmEmailChange("raw-token")).resolves.toBe("invalid");
        expect(cleanupSessionsForUser).not.toHaveBeenCalled();
    });

    it("kolizja unikalnosci emaila przy zatwierdzaniu -> taken", async () => {
        repo.lockUserByEmailChangeTokenHash.mockResolvedValue({ id: 2, pendingEmail: "taken@example.com" });
        repo.applyEmailChange.mockRejectedValue(new DatabaseError("conflict", 409, "Rekord o tych danych już istnieje."));

        await expect(confirmEmailChange("raw-token")).resolves.toBe("taken");
    });
});
