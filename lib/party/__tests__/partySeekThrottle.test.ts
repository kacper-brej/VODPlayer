import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dławienie wspólnego seeka", () => {
    it("zmiana suwaka tylko buforuje cel, a intencja wychodzi po zakończeniu ruchu", () => {
        const source = readFileSync(resolve(__dirname, "../../../components/video/PlayerControls.tsx"), "utf8");
        expect(source).toContain("onChange={(event) => setPartySeekTarget");
        expect(source).toMatch(/onPointerUp=\{\(event\) => \{\s*runPartyControl\(\(\) => partyControl\.onSeekTo/u);
        expect(source).not.toMatch(/onChange=\{[^}]*onSeekTo/u);
    });
});
