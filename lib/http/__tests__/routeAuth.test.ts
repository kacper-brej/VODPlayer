import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const requireAdmin = vi.fn();

vi.mock("@/lib/auth/session", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/auth/session")>();
    return { AuthError: original.AuthError, requireUser, requireAdmin };
});

const { AuthError } = await import("@/lib/auth/session");
const { requireAdminRoute, requireSessionRoute } = await import("../routeAuth");

const ADMIN = { id: 1, username: "kacper", email: "k@example.com", role: "admin" as const };
const VIEWER = { id: 2, username: "viewer", email: "v@example.com", role: "viewer" as const };

beforeEach(() => vi.clearAllMocks());

describe("requireSessionRoute", () => {
    it("AuthError 401 staje sie odpowiedzia 401 z komunikatem", async () => {
        requireUser.mockRejectedValue(new AuthError(401, "Brak autoryzacji."));
        const gate = await requireSessionRoute();
        expect(gate.ok).toBe(false);
        if (!gate.ok) {
            expect(gate.response.status).toBe(401);
            await expect(gate.response.json()).resolves.toEqual({ error: "Brak autoryzacji." });
        }
    });

    it("przepuszcza zalogowanego uzytkownika", async () => {
        requireUser.mockResolvedValue(VIEWER);
        await expect(requireSessionRoute()).resolves.toEqual({ ok: true, user: VIEWER });
    });
});

describe("requireAdminRoute", () => {
    it("AuthError 403 staje sie odpowiedzia 403, nie 401", async () => {
        requireAdmin.mockRejectedValue(new AuthError(403, "Brak uprawnień."));
        const gate = await requireAdminRoute();
        expect(gate.ok).toBe(false);
        if (!gate.ok) {
            expect(gate.response.status).toBe(403);
            await expect(gate.response.json()).resolves.toEqual({ error: "Brak uprawnień." });
        }
    });

    it("AuthError 401 zostaje 401", async () => {
        requireAdmin.mockRejectedValue(new AuthError(401, "Brak autoryzacji."));
        const gate = await requireAdminRoute();
        if (!gate.ok) expect(gate.response.status).toBe(401);
    });

    it("przepuszcza administratora", async () => {
        requireAdmin.mockResolvedValue(ADMIN);
        await expect(requireAdminRoute()).resolves.toEqual({ ok: true, user: ADMIN });
    });

    it("blad inny niz autoryzacyjny leci dalej", async () => {
        requireAdmin.mockRejectedValue(new Error("db down"));
        await expect(requireAdminRoute()).rejects.toThrow("db down");
    });
});
