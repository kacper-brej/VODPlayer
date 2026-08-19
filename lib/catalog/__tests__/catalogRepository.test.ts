import { describe, expect, it, vi } from "vitest";
import { loadCatalogRows } from "../catalogRepository";

describe("loadCatalogRows", () => {
    it("źródłem odcinków są wyłącznie gotowe media_assets, a publikację otwiera główny poster", async () => {
        const execute = vi.fn()
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);

        await loadCatalogRows({ execute } as never);

        const assetSql = execute.mock.calls[0]?.[0] as string;
        expect(assetSql).toMatch(/FROM media_assets a/);
        expect(assetSql).toMatch(/a\.status = 'ready'/);
        expect(assetSql).toMatch(/EXISTS[\s\S]*series_artwork[\s\S]*kind = 'poster'[\s\S]*is_primary = 1/);
        expect(assetSql).toMatch(/LEFT JOIN series_external_ids tmdb_id[\s\S]*tmdb_id\.provider = 'tmdb'/);
        expect(assetSql).not.toMatch(/scandir|uploads/i);
    });

    it("zapewnia stabilną tożsamość także dla serii dodanej wyłącznie przez CLI", async () => {
        const execute = vi.fn().mockResolvedValue([[]]);
        await loadCatalogRows({ execute } as never);
        expect(execute).toHaveBeenCalledTimes(5);
        for (const [sql] of execute.mock.calls) {
            expect(sql as string).toMatch(/^SELECT/i);
        }
    });
});
