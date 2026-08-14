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

    it("pokazuje polecenie uruchamiane z katalogu głównego", () => {
        const workflow = source("components/upload/UploadWorkflow.tsx");
        const transcodePackage = JSON.parse(source("tools/transcode/package.json")) as {
            scripts?: Record<string, string>;
        };

        expect(workflow).toContain("npm --prefix tools/transcode run transcode --");
        expect(transcodePackage.scripts?.transcode).toBeTruthy();
    });
});
