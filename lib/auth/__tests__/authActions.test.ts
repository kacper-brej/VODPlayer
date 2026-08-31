import { beforeEach, describe, expect, it, vi } from "vitest";

const login = vi.fn();
const logout = vi.fn();
const getSessionUser = vi.fn();
const createSessionForUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ login, logout, getSessionUser, createSessionForUser }));

const findUserById = vi.fn();
vi.mock("@/lib/auth/userRepository", () => ({ findUserById }));

const checkQrSession = vi.fn();
const createQrSession = vi.fn();
const approveQrSession = vi.fn();
vi.mock("@/lib/auth/qrService", () => ({ checkQrSession, createQrSession, approveQrSession }));

vi.mock("@/lib/auth/accountService", () => ({
    register: vi.fn(),
    resendVerification: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    verifyEmail: vi.fn(),
    confirmEmailChange: vi.fn(),
}));

const { checkQrSessionAction, loginAction, logoutAction } = await import("../authActions");

const user = { id: 7, username: "viewer", email: "v@example.com", role: "viewer" as const };

beforeEach(() => {
    vi.clearAllMocks();
});

describe("neutralne logowanie", () => {
    it("nie ujawnia, czy błędne dane dotyczą niepotwierdzonego konta", async () => {
        login.mockResolvedValue({ ok: false, code: "invalid" });
        const formData = new FormData();
        formData.set("identifier", "example");
        formData.set("password", "password");

        await expect(loginAction(formData)).resolves.toMatchObject({
            ok: false,
            code: "invalid",
            message: "Nieprawidłowy login lub hasło. Sprawdź dane i spróbuj ponownie.",
        });
        expect(login).toHaveBeenCalledWith("example", "password", false);
    });
});

describe("QR login", () => {
    it("konsumuje jednorazowy QR i tworzy nową, losową sesję aplikacji", async () => {
        checkQrSession
            .mockResolvedValueOnce({ status: "approved", userId: user.id })
            .mockResolvedValueOnce({ status: "expired" });
        findUserById.mockResolvedValue(user);

        await expect(checkQrSessionAction("one-time-qr")).resolves.toEqual({ status: "approved", user });
        await expect(checkQrSessionAction("one-time-qr")).resolves.toEqual({ status: "expired" });
        expect(createSessionForUser).toHaveBeenCalledTimes(1);
        expect(createSessionForUser).toHaveBeenCalledWith(user, false);
    });
});

describe("logout action", () => {
    it("przekazuje UI informację o nieudanej revokacji", async () => {
        logout.mockResolvedValue({ ok: false, code: "server" });
        await expect(logoutAction()).resolves.toEqual({ ok: false, code: "server" });
    });
});
