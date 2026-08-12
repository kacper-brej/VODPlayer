import { describe, expect, it, vi, beforeEach } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

const requestPasswordReset = vi.fn();
vi.mock("@/lib/auth/accountService", () => ({ requestPasswordReset }));

const { default: requestPasswordChangeAction } = await import("../requestPasswordChangeAction");

beforeEach(() => vi.clearAllMocks());

describe("requestPasswordChangeAction — deleguje do accountService, nie woła juz PHP", () => {
    it("niezalogowany -> unauthenticated, brak wysylki", async () => {
        getSessionUser.mockResolvedValue(null);
        await expect(requestPasswordChangeAction()).resolves.toEqual({ success: false, error: "unauthenticated" });
        expect(requestPasswordReset).not.toHaveBeenCalled();
    });

    it("zalogowany -- uzywa adresu e-mail z biezacej sesji, nie z wejscia klienta", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Kacper", email: "k@example.com", role: "viewer" });
        requestPasswordReset.mockResolvedValue({ ok: true });

        await expect(requestPasswordChangeAction()).resolves.toEqual({ success: true });
        expect(requestPasswordReset).toHaveBeenCalledWith("k@example.com");
    });

    it("blad serwisu (np. rate limit) -> backend", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "Kacper", email: "k@example.com", role: "viewer" });
        requestPasswordReset.mockResolvedValue({ ok: false, code: "rate_limited" });

        await expect(requestPasswordChangeAction()).resolves.toEqual({ success: false, error: "backend" });
    });
});
