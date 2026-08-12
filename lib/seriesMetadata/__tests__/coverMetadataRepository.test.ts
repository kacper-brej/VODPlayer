import { describe, expect, it, vi } from "vitest";
import { syncSeriesGenres, upsertCoverMetadata } from "../coverMetadataRepository";

describe("coverMetadataRepository", () => {
    it("chroni ręczny backdrop przed automatycznym nadpisaniem", async () => {
        const execute = vi.fn().mockResolvedValue([{ insertId: 1 }]);
        await upsertCoverMetadata({
            title: "Seria", coverImage: "/poster.jpg", backdropImage: "/auto.jpg", backdropSource: "jikan",
            synopsis: null, rating: null, ageRating: null, year: null, studio: null, genres: [],
        }, { execute } as never);
        const sql = String(execute.mock.calls[0]?.[0]);
        expect(sql).toContain("WHEN backdrop_source = 'manual' THEN backdrop_image");
        expect(sql).toContain("WHEN backdrop_source = 'manual' THEN backdrop_source");
    });

    it("normalizuje gatunki i odtwarza powiązania", async () => {
        const execute = vi.fn()
            .mockResolvedValueOnce([{ insertId: 7 }])
            .mockResolvedValueOnce([{ insertId: 8 }])
            .mockResolvedValue([{ affectedRows: 1 }]);
        await syncSeriesGenres("Seria", ["Akcja", "Sci-Fi"], { execute } as never);
        expect(execute).toHaveBeenNthCalledWith(1, expect.any(String), ["Akcja", "akcja"]);
        expect(execute).toHaveBeenNthCalledWith(2, expect.any(String), ["Sci-Fi", "sci-fi"]);
        expect(execute).toHaveBeenCalledWith("DELETE FROM series_genres WHERE series_key = ?", ["Seria"]);
    });
});
