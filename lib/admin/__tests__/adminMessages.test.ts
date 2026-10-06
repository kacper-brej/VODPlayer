import { describe, expect, it } from "vitest";
import { seasonUpdateMessage } from "../adminMessages";
import type { EpisodeStillsResult } from "../episodeStillsBackfillAction";

describe("komunikat po zmianie sezonu", () => {
    const result: EpisodeStillsResult = { title: "Serial", status: "updated", matchedEpisodes: 12, countMismatch: false };
    it.each(["lookup-failed", "save-failed", "no-tmdb-mapping", "season-ambiguous", "no-episodes"] as const)("nie zgłasza pełnego sukcesu przy %s", (status) => {
        const message = seasonUpdateMessage({ ...result, status });
        expect(message.tone).not.toBe("success");
        expect(message.text).toContain("Zapisano numer sezonu.");
        expect(message.text).toMatch(/ponownie/);
    });
    it("oddziela pełne, częściowe i puste dopasowanie", () => {
        expect(seasonUpdateMessage(result).tone).toBe("success");
        expect(seasonUpdateMessage({ ...result, countMismatch: true }).tone).toBe("info");
        expect(seasonUpdateMessage({ ...result, matchedEpisodes: 0 }).tone).toBe("info");
    });
});
