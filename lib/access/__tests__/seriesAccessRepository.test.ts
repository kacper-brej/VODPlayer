import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const {
    deleteDemoProgressForUser,
    findSeriesVisibility,
    grantSeriesAccess,
    listAllGrants,
    loadUserGrants,
    loadVisibilityMap,
    setSeriesVisibility,
} = await import("../seriesAccessRepository");

const db = { execute } as never;

beforeEach(() => execute.mockReset());

describe("odczyt widoczności i uprawnień", () => {
    it("mapa widoczności powstaje z jednego zapytania", async () => {
        execute.mockResolvedValueOnce([[
            { series_key: "Tokyo Ghoul", visibility: "restricted" },
            { series_key: "_demo", visibility: "system" },
        ]]);

        const map = await loadVisibilityMap(db);

        expect(map.get("Tokyo Ghoul")).toBe("restricted");
        expect(map.get("_demo")).toBe("system");
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("brak wiersza widoczności zwraca null, a nie wartość domyślną z bazy", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(findSeriesVisibility("Nieznany", db)).resolves.toBeNull();
    });

    it("uprawnienia konta są filtrowane po user_id w zapytaniu", async () => {
        execute.mockResolvedValueOnce([[{ series_key: "Tokyo Ghoul" }]]);

        await expect(loadUserGrants(7, db)).resolves.toEqual(["Tokyo Ghoul"]);
        expect(execute).toHaveBeenCalledWith(expect.stringContaining("WHERE user_id = ?"), [7]);
    });

    it("pełna lista uprawnień zwraca znacznik czasu jako liczbę", async () => {
        execute.mockResolvedValueOnce([[{ series_key: "Tokyo Ghoul", user_id: "2", granted_at: "1700000000" }]]);

        await expect(listAllGrants(db)).resolves.toEqual([
            { seriesKey: "Tokyo Ghoul", userId: 2, grantedAt: 1_700_000_000 },
        ]);
    });
});

describe("zapis", () => {
    it("ustawienie poziomu jest idempotentne", async () => {
        execute.mockResolvedValueOnce([{}]);

        await setSeriesVisibility("Tokyo Ghoul", "public", db);

        expect(execute).toHaveBeenCalledWith(
            expect.stringContaining("ON DUPLICATE KEY UPDATE visibility = VALUES(visibility)"),
            ["Tokyo Ghoul", "public"],
        );
    });

    it("ponowne nadanie uprawnienia odświeża autora i datę zamiast błędu duplikatu", async () => {
        execute.mockResolvedValueOnce([{}]);

        await grantSeriesAccess("Tokyo Ghoul", 2, 1, db);

        expect(execute).toHaveBeenCalledWith(
            expect.stringContaining("ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by)"),
            ["Tokyo Ghoul", 2, 1],
        );
    });
});

describe("czyszczenie postępu demonstracyjnego", () => {
    it("obejmuje wszystkie profile konta przez złączenie z profiles", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 4 }]);

        await expect(deleteDemoProgressForUser(2, "Tokyo Ghoul", 99, db)).resolves.toBe(4);

        const [sql, params] = execute.mock.calls[0] ?? [];
        expect(sql).toMatch(/DELETE wp FROM watch_progress wp[\s\S]+INNER JOIN profiles p ON p\.id = wp\.profile_id/);
        expect(sql).toContain("p.user_id = ?");
        expect(params).toEqual([2, "Tokyo Ghoul", 99]);
    });

    it("nie kasuje postępu z prawdziwego materiału ani z innych seriali", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 0 }]);

        await deleteDemoProgressForUser(2, "Tokyo Ghoul", 99, db);

        const [sql] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("wp.series_key = ?");
        expect(sql).toContain("wp.media_asset_id = ?");
    });
});
