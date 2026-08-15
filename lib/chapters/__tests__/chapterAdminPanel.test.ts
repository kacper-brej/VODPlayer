import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("chapter admin panel", () => {
    it("udostępnia panel w chronionej sekcji administratora", () => {
        const page = source("app/(app)/admin/chapters/page.tsx");
        const navigation = source("components/admin/AdminSectionNav.tsx");

        expect(page).toContain("getAdminLibraryAction()");
        expect(page).toContain("ChapterEditor");
        expect(navigation).toContain('href: "/admin/chapters"');
    });

    it("obsługuje odczyt, zapis dla odcinka lub serii oraz usuwanie", () => {
        const editor = source("components/admin/ChapterEditor.tsx");

        expect(editor).toContain("fetch(`/api/chapters?");
        expect(editor).toContain('method: "POST"');
        expect(editor).toContain('method: "DELETE"');
        expect(editor).toContain("applyToSeries");
        expect(editor).toContain("intro");
        expect(editor).toContain("recap");
        expect(editor).toContain("outro");
    });

    it("usuwa pustą trasę pobierania bez backendu offline", () => {
        expect(existsSync(resolve(process.cwd(), "app/(app)/downloads/page.tsx"))).toBe(false);
    });
});
