import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("recent catalog page", () => {
    it("korzysta ze wspólnego katalogu w trybie ostatnio dodanych", () => {
        const page = source("app/(app)/recent/page.tsx");

        expect(page).toContain("CatalogScreen");
        expect(page).toContain('mode="recent"');
        expect(page).toContain('basePath="/recent"');
        expect(page).toContain("searchParams={searchParams}");
    });

    it("domyślnie sortuje ten tryb według daty dodania odcinka", () => {
        const catalog = source("components/series/CatalogScreen.tsx");

        expect(catalog).toContain('const defaultSort = mode === "recent" ? "newest" : "featured"');
        expect(catalog).toContain("newestEpisodeAddedAt(b) - newestEpisodeAddedAt(a)");
    });

    it("pozwala zmienić sortowanie i zachowuje newest jako domyślne tylko dla /recent", () => {
        const catalog = source("components/series/CatalogScreen.tsx");
        const filters = source("components/series/CatalogFilterBar.tsx");

        expect(catalog).toContain("defaultSort={defaultSort}");
        expect(catalog).toContain('sort !== defaultSort');
        expect(filters).toContain('defaultSort = "featured"');
        expect(filters).toContain("nextSort !== defaultSort");
    });
});
