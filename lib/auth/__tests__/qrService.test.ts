import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}),
}));

const repo = {
    insertQrSession: vi.fn(),
    deleteExpiredQrSessions: vi.fn(),
    lockQrSessionByTokenHash: vi.fn(),
    deleteQrSessionById: vi.fn(),
    markQrSessionApproved: vi.fn(),
};
vi.mock("@/lib/auth/qrRepository", () => repo);

const consumeLoginRateLimit = vi.fn();
vi.mock("@/lib/auth/rateLimit", () => ({ consumeLoginRateLimit }));

vi.mock("@/lib/auth/clientIp", () => ({ clientIp: async () => "203.0.113.7" }));

const { createQrSession, approveQrSession, checkQrSession } = await import("../qrService");

beforeEach(() => {
    vi.clearAllMocks();
    consumeLoginRateLimit.mockResolvedValue(false);
});

describe("createQrSession", () => {
    it("czysci wygasle sesje, tworzy nowa z hashem tokenu i TTL 180s", async () => {
        const result = await createQrSession("login");

        expect(repo.deleteExpiredQrSessions).toHaveBeenCalledOnce();
        expect(repo.insertQrSession).toHaveBeenCalledWith("login", expect.stringMatching(/^[0-9a-f]{64}$/), expect.any(Date));
        expect(result?.token).toMatch(/^[0-9a-f]{64}$/);
        expect(result?.expiresIn).toBe(180);
    });

    it("rate limit (SEC-21) -> null, brak zapisu do bazy", async () => {
        consumeLoginRateLimit.mockResolvedValue(true);

        await expect(createQrSession("login")).resolves.toBeNull();
        expect(repo.insertQrSession).not.toHaveBeenCalled();
    });

    it("purpose=register przekazywany do repo", async () => {
        await createQrSession("register");
        expect(repo.insertQrSession).toHaveBeenCalledWith("register", expect.any(String), expect.any(Date));
    });
});

describe("approveQrSession", () => {
    it("sukces -> ok", async () => {
        repo.markQrSessionApproved.mockResolvedValue(true);
        await expect(approveQrSession("raw-token", 5)).resolves.toBe("ok");
        expect(repo.markQrSessionApproved).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/), 5);
    });

    it("wygasly/nieznany/zly purpose (guard w SQL repo) -> invalid", async () => {
        repo.markQrSessionApproved.mockResolvedValue(false);
        await expect(approveQrSession("raw-token", 5)).resolves.toBe("invalid");
    });

    it("dwie rownolegle akceptacje tego samego tokenu -> tylko pierwsza wygrywa", async () => {
        repo.markQrSessionApproved.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        const [first, second] = await Promise.all([
            approveQrSession("raw-token", 5),
            approveQrSession("raw-token", 9),
        ]);

        expect([first, second]).toContain("ok");
        expect([first, second]).toContain("invalid");
    });

    it("pusty token -> invalid bez dotykania bazy", async () => {
        await expect(approveQrSession("", 5)).resolves.toBe("invalid");
        expect(repo.markQrSessionApproved).not.toHaveBeenCalled();
    });
});

describe("checkQrSession", () => {
    const future = () => new Date(Date.now() + 60_000);
    const past = () => new Date(Date.now() - 1_000);

    it("nieznany token -> expired", async () => {
        repo.lockQrSessionByTokenHash.mockResolvedValue(null);
        await expect(checkQrSession("raw-token")).resolves.toEqual({ status: "expired" });
    });

    it("wygasly token -> expired, sprzata wiersz", async () => {
        repo.lockQrSessionByTokenHash.mockResolvedValue({
            id: 1, purpose: "login", status: "pending", userId: null, expiresAt: past(),
        });

        await expect(checkQrSession("raw-token")).resolves.toEqual({ status: "expired" });
        expect(repo.deleteQrSessionById).toHaveBeenCalledWith(1, {});
    });

    it("status pending -> pending, bez usuwania", async () => {
        repo.lockQrSessionByTokenHash.mockResolvedValue({
            id: 1, purpose: "login", status: "pending", userId: null, expiresAt: future(),
        });

        await expect(checkQrSession("raw-token")).resolves.toEqual({ status: "pending" });
        expect(repo.deleteQrSessionById).not.toHaveBeenCalled();
    });

    it("status awaiting_verification -> verification", async () => {
        repo.lockQrSessionByTokenHash.mockResolvedValue({
            id: 1, purpose: "register", status: "awaiting_verification", userId: 3, expiresAt: future(),
        });

        await expect(checkQrSession("raw-token")).resolves.toEqual({ status: "verification" });
    });

    it("status approved -> zwraca userId i KONSUMUJE (usuwa) sesje", async () => {
        repo.lockQrSessionByTokenHash.mockResolvedValue({
            id: 1, purpose: "login", status: "approved", userId: 7, expiresAt: future(),
        });

        await expect(checkQrSession("raw-token")).resolves.toEqual({ status: "approved", userId: 7 });
        expect(repo.deleteQrSessionById).toHaveBeenCalledWith(1, {});
    });

    it("replay: drugi check po konsumpcji nie znajduje juz wiersza -> expired, nie approved ponownie", async () => {
        repo.lockQrSessionByTokenHash
            .mockResolvedValueOnce({ id: 1, purpose: "login", status: "approved", userId: 7, expiresAt: future() })
            .mockResolvedValueOnce(null);

        await expect(checkQrSession("raw-token")).resolves.toEqual({ status: "approved", userId: 7 });
        await expect(checkQrSession("raw-token")).resolves.toEqual({ status: "expired" });
    });

    it("pusty token -> expired bez zapytania do bazy", async () => {
        await expect(checkQrSession("")).resolves.toEqual({ status: "expired" });
        expect(repo.lockQrSessionByTokenHash).not.toHaveBeenCalled();
    });
});
