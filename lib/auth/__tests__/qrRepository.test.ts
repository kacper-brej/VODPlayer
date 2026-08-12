import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { insertQrSession, markQrSessionApproved, deleteExpiredQrSessions } = await import("../qrRepository");

beforeEach(() => execute.mockReset());

describe("insertQrSession", () => {
    it("wstawia z status='pending' na sztywno w SQL", async () => {
        execute.mockResolvedValueOnce([{}]);
        await insertQrSession("login", "hash123", new Date());
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("'pending'"), ["hash123", "login", expect.any(Date)]);
    });
});

describe("markQrSessionApproved", () => {
    it("SQL pilnuje purpose='login' AND status='pending' AND expires_at>NOW() -- guard przed race i zlym purpose", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const sql = expect.stringMatching(/purpose\s*=\s*'login'[\s\S]*status\s*=\s*'pending'[\s\S]*expires_at\s*>\s*NOW\(\)/);
        await markQrSessionApproved("hash123", 5);
        expect(execute).toHaveBeenCalledWith(sql, [5, "hash123"]);
    });

    it("affectedRows=0 (drugi zawodnik race'u) -> false", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
        await expect(markQrSessionApproved("hash123", 5)).resolves.toBe(false);
    });

    it("affectedRows=1 -> true", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        await expect(markQrSessionApproved("hash123", 5)).resolves.toBe(true);
    });
});

describe("deleteExpiredQrSessions", () => {
    it("kasuje z limitem, zeby nie zablokowac tabeli jedna wielka operacja", async () => {
        execute.mockResolvedValueOnce([{}]);
        await deleteExpiredQrSessions(undefined, 20);
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("LIMIT"), [20]);
    });
});
