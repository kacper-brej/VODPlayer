import { describe, expect, it, vi } from "vitest";
import { applyEmailChange, applyPasswordReset } from "../accountRepository";

describe("atomowa bariera revokacji przy zmianach bezpieczeństwa", () => {
    it("reset hasła podnosi sessions_valid_from w tym samym UPDATE", async () => {
        const execute = vi.fn().mockResolvedValue([{}]);
        await applyPasswordReset(11, "new-password-hash", { execute } as never);

        const sql = execute.mock.calls[0]?.[0] as string;
        expect(sql).toContain("password_hash = ?");
        expect(sql).toContain("sessions_valid_from = CURRENT_TIMESTAMP(6)");
        expect(execute).toHaveBeenCalledWith(expect.any(String), ["new-password-hash", 11]);
    });

    it("zmiana e-maila podnosi sessions_valid_from w tym samym UPDATE", async () => {
        const execute = vi.fn().mockResolvedValue([{}]);
        await applyEmailChange(12, { execute } as never);

        const sql = execute.mock.calls[0]?.[0] as string;
        expect(sql).toContain("email = pending_email");
        expect(sql).toContain("sessions_valid_from = CURRENT_TIMESTAMP(6)");
        expect(execute).toHaveBeenCalledWith(expect.any(String), [12]);
    });
});
