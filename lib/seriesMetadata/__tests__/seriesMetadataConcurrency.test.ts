import { describe, expect, it, vi } from "vitest";
import type { ArtworkCandidateWrite } from "../seriesMetadataContracts";

let active = 0;
let maximum = 0;
vi.mock("@/lib/artwork/artworkProcessor", () => ({
    downloadAndProcessArtwork: vi.fn(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { dominantColor: "#000000", placeholder: "data:image/jpeg;base64,AA==" };
    }),
}));

const { ARTWORK_PROCESSING_CONCURRENCY, prepareArtworkCandidates } = await import("../seriesMetadataService");

const candidate = (index: number): ArtworkCandidateWrite => ({
    kind: "poster",
    url: `https://image.tmdb.org/t/p/original/${index}.jpg`,
    width: 600,
    height: 900,
    provider: "tmdb",
    language: null,
    primary: "never" === String(index) ? "never" : "if-absent",
    matchSource: "auto",
    dominantColor: null,
    placeholder: null,
});

describe("prepareArtworkCandidates", () => {
    it("ogranicza globalna rownoleglosc pobierania i obrobki grafik", async () => {
        const result = await prepareArtworkCandidates(Array.from({ length: 8 }, (_, index) => candidate(index)));
        expect(result).toHaveLength(8);
        expect(maximum).toBeLessThanOrEqual(ARTWORK_PROCESSING_CONCURRENCY);
        expect(maximum).toBe(ARTWORK_PROCESSING_CONCURRENCY);
    });
});
