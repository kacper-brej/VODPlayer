import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const execute = vi.fn();

vi.mock("@/lib/db/pool", () => ({
    getDbPool: () => ({ execute }),
}));

const {
    advanceSessionsValidFrom,
    createSession,
    deleteAllSessionsForUser,
    deleteExpiredSessions,
    deleteSession,
    findSessionUser,
} = await import("../sessionRepository");

describe("createSession", () => {
    beforeEach(() => execute.mockReset());

    it("zwraca losowy raw token i zapisuje wylacznie jego SHA-256 hash", async () => {
        execute.mockResolvedValueOnce([{}]);
        const expiresAt = new Date();

        const rawToken = await createSession(42, expiresAt);

        expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
        const expectedHash = createHash("sha256").update(rawToken).digest("hex");
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO sessions"), [
            expectedHash,
            42,
            expiresAt,
        ]);
    });

    it("dwa wywolania daja rozne tokeny", async () => {
        execute.mockResolvedValue([{}]);
        const a = await createSession(1, new Date());
        const b = await createSession(1, new Date());
        expect(a).not.toBe(b);
    });
});

describe("findSessionUser", () => {
    beforeEach(() => execute.mockReset());

    it("zwraca użytkownika dla ważnej sesji", async () => {
        execute.mockResolvedValueOnce([[
            { id: 7, username: "viewer", email: "v@example.com", role: "viewer" },
        ]]);
        await expect(findSessionUser("aaa")).resolves.toEqual({
            id: 7, username: "viewer", email: "v@example.com", role: "viewer",
        });
    });

    it("zwraca null, gdy SQL odrzuci wygasłą, obcą albo starszą od bariery sesję", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(findSessionUser("aaa")).resolves.toBeNull();
        const sql = execute.mock.calls[0]?.[0] as string;
        expect(sql).toMatch(/INNER JOIN users u ON u\.id = s\.user_id/u);
        expect(sql).toMatch(/s\.expires_at > CURRENT_TIMESTAMP\(6\)/u);
        expect(sql).toMatch(/s\.created_at >= u\.sessions_valid_from/u);
    });

    it("ta sama stara sesja działa przed podniesieniem bariery i przestaje działać po nim", async () => {
        const row = { id: 7, username: "viewer", email: "v@example.com", role: "viewer" };
        execute.mockResolvedValueOnce([[row]]).mockResolvedValueOnce([[]]);

        await expect(findSessionUser("old-session")).resolves.toMatchObject({ id: 7 });
        await expect(findSessionUser("old-session")).resolves.toBeNull();
    });

    it("hashuje token przed zapytaniem, nigdy nie wysyla surowego tokenu do SQL", async () => {
        execute.mockResolvedValueOnce([[]]);
        await findSessionUser("raw-token-value");
        const expectedHash = createHash("sha256").update("raw-token-value").digest("hex");
        expect(execute).toHaveBeenCalledWith(expect.any(String), [expectedHash]);
    });

    it("nie loguje surowego tokenu ani hasha nawet gdy sterownik dołącza SQL do błędu", async () => {
        const rawToken = "raw-token-that-must-not-be-logged";
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        execute.mockRejectedValueOnce({ code: "ER_PARSE_ERROR", sql: `SELECT '${tokenHash}'` });
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(findSessionUser(rawToken)).rejects.toBeDefined();
        const logged = JSON.stringify(log.mock.calls);
        expect(logged).not.toContain(rawToken);
        expect(logged).not.toContain(tokenHash);
        log.mockRestore();
    });
});

describe("deleteSession / deleteAllSessionsForUser", () => {
    beforeEach(() => execute.mockReset());

    it("deleteSession usuwa po zahashowanym id", async () => {
        execute.mockResolvedValueOnce([{}]);
        await deleteSession("raw-token-value");
        const expectedHash = createHash("sha256").update("raw-token-value").digest("hex");
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM sessions WHERE id"), [expectedHash]);
    });

    it("deleteAllSessionsForUser usuwa po user_id", async () => {
        execute.mockResolvedValueOnce([{}]);
        await deleteAllSessionsForUser(99);
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("WHERE user_id"), [99]);
    });

    it("advanceSessionsValidFrom atomowo podnosi barierę czasu po stronie DB", async () => {
        execute.mockResolvedValueOnce([{}]);
        await advanceSessionsValidFrom(99);
        expect(execute).toHaveBeenCalledWith(
            expect.stringContaining("sessions_valid_from = CURRENT_TIMESTAMP(6)"),
            [99],
        );
    });

    it("cleanup wygasłych sesji ma ograniczony batch", async () => {
        execute.mockResolvedValueOnce([{}]);
        await deleteExpiredSessions(100);
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("LIMIT ?"), [100]);
        await expect(deleteExpiredSessions(0)).rejects.toThrow("1-1000");
    });
});
