import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("operator media entry points", () => {
    it("nie kieruje pustych stanów do wyłączonej trasy /upload", () => {
        const emptyStates = [
            source("app/(app)/page.tsx"),
            source("components/series/CatalogScreen.tsx"),
        ].join("\n");

        expect(emptyStates).not.toContain('href="/upload"');
        expect(emptyStates).toContain('href="/admin/upload"');
    });

    it("kieruje do istniejącego importu i nie pokazuje polecenia nieobecnego transkodera", () => {
        const workflow = source("components/upload/UploadWorkflow.tsx");
        expect(workflow).toContain('href="/admin/library-scan"');
        expect(workflow).toContain("Przesyłanie wideo przez przeglądarkę nie jest dostępne.");
        expect(workflow).not.toContain("npm --prefix tools/transcode");
        expect(source("app/(app)/admin/library-scan/page.tsx")).toContain("LibraryScanPanel");
    });
});
