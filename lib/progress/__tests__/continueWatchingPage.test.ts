import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("continue watching page", () => {
    it("łączy historię oglądania z katalogiem i prowadzi bezpośrednio do wznowienia", () => {
        const page = source("app/(app)/continue/page.tsx");

        expect(page).toContain("getContinueWatching()");
        expect(page).toContain("toResumeCard(series, resume");
        expect(page).toContain('href="/explore"');
        expect(page).toContain("DataErrorState");
    });

    it("nadaje siatce opis właściwy dla bieżącej strony", () => {
        const page = source("app/(app)/continue/page.tsx");
        const grid = source("components/series/CatalogGrid.tsx");

        expect(page).toContain('ariaLabel="Rozpoczęte tytuły"');
        expect(grid).toContain("aria-label={ariaLabel}");
    });
});
