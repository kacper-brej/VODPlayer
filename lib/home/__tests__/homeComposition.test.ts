import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_SECTION_ORDER } from "../homeLayout";

const root = process.cwd();
const readSource = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");
const homePage = readSource("app/(app)/page.tsx");

const sourceFiles = (relativeDir: string): string[] => {
    const walk = (dir: string): string[] => statSync(dir).isDirectory()
        ? readdirSync(dir).flatMap((entry) => walk(join(dir, entry)))
        : /\.tsx?$/u.test(dir) ? [dir] : [];

    return walk(resolve(root, relativeDir));
};

const clientComponents = [...sourceFiles("app"), ...sourceFiles("components")]
    .map((path) => ({ path, source: readFileSync(path, "utf8") }))
    .filter((file) => /^\s*["']use client["']/u.test(file.source));

describe("sklad strony glownej w app/(app)/page.tsx", () => {
    it("renderuje sekcje w docelowej kolejnosci", () => {
        const rendered = [...homePage.matchAll(/<RowFallback id="([a-z-]+)"/gu)]
            .map((match) => match[1]);

        expect(rendered).toEqual([...HOME_SECTION_ORDER]);
    });

    it("kazda sekcja ma wlasna granice Suspense z dopasowanym skeletonem", () => {
        const boundaries = homePage.match(/<Suspense fallback=\{<RowFallback id="[a-z-]+" \/>\}>/gu) ?? [];

        expect(boundaries).toHaveLength(HOME_SECTION_ORDER.length);
    });

    it("nie numeruje sekcji na sztywno, tylko licznikiem renderowanych rzedow", () => {
        const rows = homePage.match(/<ContentRowSection[\s\S]*?\/>/gu) ?? [];

        expect(homePage).not.toMatch(/N°/u);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => row.includes("numbered"))).toBe(true);
        expect(homePage).toMatch(/<ContentRowSkeleton[\s\S]*?numbered[\s\S]*?\/>/u);
        expect(homePage).toContain("nx-home-rows");
    });

    it("licznik CSS pomija ukryte sekcje", () => {
        const styles = readSource("app/globals.css");

        expect(styles).toMatch(/\.nx-home-rows\s*\{\s*counter-reset:\s*nx-home-row;/u);
        expect(styles).toMatch(/\.nx-row-index\s*\{\s*counter-increment:\s*nx-home-row;/u);
        expect(styles).toMatch(/counter\(nx-home-row, decimal-leading-zero\)/u);
    });

    it("nie pokazuje technicznego bledu TMDB, tylko chowa zalezny rzad", () => {
        const tmdbSection = homePage.match(/const TmdbRowSection[\s\S]*?\n\};/u)?.[0] ?? "";

        expect(tmdbSection).toContain("if (!section) return null;");
        expect(tmdbSection).not.toContain("DataErrorState");
    });

    it("nie zostawia dwoch sekcji o tej samej roli", () => {
        expect(homePage).not.toContain("Wybrane dla Ciebie");
        expect(homePage).not.toContain("Dziesiątka tej nocy");
        expect(homePage).not.toContain("getWeeklyRanking");
    });
});

describe("granice serwerowe sekcji TMDB", () => {
    it("moduly list i sekcji sa wylacznie serwerowe", () => {
        for (const path of ["lib/metadata/tmdbLists.ts", ...sourceFiles("lib/home")
            .filter((file) => !file.includes("__tests__"))
            .map((file) => file.slice(root.length + 1))]) {
            expect(readSource(path)).toMatch(/^import "server-only";/u);
        }
    });

    it("zaden komponent kliencki nie siega do TMDB ani do sekcji strony glownej", () => {
        const offenders = clientComponents.filter((file) =>
            /@\/lib\/(home|metadata)\//u.test(file.source)
        );

        expect(offenders.map((file) => file.path)).toEqual([]);
    });

    it("zaden route handler nie wystawia list TMDB do przegladarki", () => {
        const handlers = sourceFiles("app/api").filter((path) => /route\.tsx?$/u.test(path));
        const offenders = handlers.filter((path) =>
            /@\/lib\/(home|metadata\/tmdb)/u.test(readFileSync(path, "utf8"))
        );

        expect(offenders).toEqual([]);
    });
});
