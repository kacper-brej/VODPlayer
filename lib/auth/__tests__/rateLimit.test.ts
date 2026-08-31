import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
const release = vi.fn();
const getConnection = vi.fn(async () => ({ execute, release }));

vi.mock("@/lib/db/pool", () => ({
    getDbPool: () => ({ execute, getConnection }),
}));

const { clearLoginIdentifierAttempts, consumeLoginRateLimit, deleteOldAuthAttempts } = await import("../rateLimit");

const lockAcquired = () => execute.mockResolvedValueOnce([[{ acquired: 1 }]]);
const counted = (value: number) => execute.mockResolvedValueOnce([[{ count: value }]]);

describe("consumeLoginRateLimit", () => {
    beforeEach(() => {
        execute.mockReset();
        release.mockReset();
    });

    it("false gdy oba liczniki poniżej progu; zapisuje próbę i zwalnia połączenie", async () => {
        lockAcquired();
        lockAcquired();
        counted(3);
        counted(1);
        execute.mockResolvedValueOnce([{}]);
        execute.mockResolvedValue([[]]);

        await expect(consumeLoginRateLimit("1.2.3.4", "a@b.pl")).resolves.toBe(false);
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO auth_attempts"), ["1.2.3.4", "a@b.pl"]);
        expect(release).toHaveBeenCalledTimes(1);
    });

    it("true gdy licznik IP osiągnął próg, bez zapisu kolejnej próby", async () => {
        lockAcquired();
        lockAcquired();
        counted(10);
        execute.mockResolvedValue([[]]);

        await expect(consumeLoginRateLimit("1.2.3.4", "a@b.pl")).resolves.toBe(true);
        expect(execute).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO auth_attempts"), expect.anything());
        expect(release).toHaveBeenCalledTimes(1);
    });

    it("nieudane zajęcie blokady traktuje jak przekroczenie limitu", async () => {
        execute.mockResolvedValueOnce([[{ acquired: 0 }]]);
        execute.mockResolvedValue([[]]);

        await expect(consumeLoginRateLimit("1.2.3.4", "a@b.pl")).resolves.toBe(true);
        expect(release).toHaveBeenCalledTimes(1);
    });

    it("bierze blokady w kolejności posortowanej, niezależnie od kolejności argumentów", async () => {
        lockAcquired();
        lockAcquired();
        counted(0);
        counted(0);
        execute.mockResolvedValueOnce([{}]);
        execute.mockResolvedValue([[]]);

        await consumeLoginRateLimit("1.2.3.4", "a@b.pl");
        const lockScopes = execute.mock.calls
            .filter(([sql]) => typeof sql === "string" && sql.includes("GET_LOCK"))
            .map(([, params]) => (params as string[])[0]!);
        expect(lockScopes).toEqual([...lockScopes].sort());
    });
});

describe("deleteOldAuthAttempts", () => {
    beforeEach(() => execute.mockReset());

    it("usuwa rekordy starsze niż okno limitu, z ograniczeniem liczby wierszy", async () => {
        execute.mockResolvedValueOnce([{}]);
        await deleteOldAuthAttempts(250);
        expect(execute).toHaveBeenCalledWith(
            expect.stringContaining("DELETE FROM auth_attempts"),
            [250],
        );
        expect(execute.mock.calls[0]![0]).toContain("INTERVAL 900 SECOND");
    });

    it("odrzuca limit poza zakresem, zanim dotknie bazy", async () => {
        await expect(deleteOldAuthAttempts(0)).rejects.toThrow("1-10000");
        await expect(deleteOldAuthAttempts(10_001)).rejects.toThrow("1-10000");
        expect(execute).not.toHaveBeenCalled();
    });
});

describe("clearLoginIdentifierAttempts", () => {
    beforeEach(() => execute.mockReset());

    it("po udanym logowaniu czyści wspólny licznik identyfikatora", async () => {
        execute.mockResolvedValueOnce([{}]);
        await clearLoginIdentifierAttempts("example");
        expect(execute).toHaveBeenCalledWith(
            expect.stringContaining("DELETE FROM auth_attempts WHERE email"),
            ["example"],
        );
    });
});
