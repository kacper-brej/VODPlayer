import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("granica read-only preview", () => {
    it("backend preview nie importuje zapisu progresu ani /api/progress", () => {
        const files = [
            "lib/player/previewService.ts",
            "lib/player/previewHlsService.ts",
            "app/api/preview/route.ts",
            "app/api/preview/clip/route.ts",
            "app/api/preview/hls/route.ts",
        ];
        for (const file of files) {
            const source = readFileSync(resolve(process.cwd(), file), "utf8");
            expect(source, file).not.toContain("progressRepository");
            expect(source, file).not.toContain("saveProgress");
            expect(source, file).not.toContain("upsertWatchProgress");
            expect(source, file).not.toContain("/api/progress");
        }
    });
});
