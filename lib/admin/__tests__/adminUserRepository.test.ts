import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { listUsers } = await import("../adminUserRepository");

beforeEach(() => execute.mockReset());

describe("listUsers", () => {
    it("sortuje po created_at malejaco", async () => {
        execute.mockResolvedValueOnce([[]]);
        await listUsers();
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY created_at DESC/));
    });

    it("mapuje email_verified TINYINT na boolean, zachowuje role bez zmian", async () => {
        execute.mockResolvedValueOnce([[
            { id: 1, username: "Kacper", email: "k@example.com", email_verified: 1, role: "admin", created_at: 1000 },
            { id: 2, username: "Widz", email: "w@example.com", email_verified: 0, role: "viewer", created_at: 900 },
        ]]);

        await expect(listUsers()).resolves.toEqual([
            { id: 1, username: "Kacper", email: "k@example.com", emailVerified: true, role: "admin", createdAt: 1000 },
            { id: 2, username: "Widz", email: "w@example.com", emailVerified: false, role: "viewer", createdAt: 900 },
        ]);
    });
});
