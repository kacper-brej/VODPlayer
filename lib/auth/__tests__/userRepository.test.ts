import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("@/lib/db/pool", () => ({
    getDbPool: () => ({ execute }),
}));

const { findUserForLogin } = await import("../userRepository");

describe("findUserForLogin", () => {
    beforeEach(() => execute.mockReset());

    it("wyszukuje zarówno po adresie e-mail, jak i nazwie użytkownika", async () => {
        execute.mockResolvedValueOnce([[{
            id: 9,
            username: "example",
            email: "example@example.com",
            password_hash: "hash",
            email_verified: 1,
            role: "viewer",
            onboarded_at: "2026-08-31 12:00:00",
        }]]);

        await expect(findUserForLogin("example")).resolves.toMatchObject({
            id: 9,
            username: "example",
            emailVerified: true,
            role: "viewer",
        });
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/email = \? OR username = \?/u), [
            "example",
            "example",
        ]);
    });
});
