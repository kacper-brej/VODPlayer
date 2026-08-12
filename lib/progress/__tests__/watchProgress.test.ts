import { describe, expect, it } from "vitest";
import { isEpisodeComplete } from "../watchProgress";

describe("jedna reguła completion", () => {
    it("ukończa przy 90%", () => expect(isEpisodeComplete(1080, 1200)).toBe(true));
    it("nie ukończa przed progiem", () => expect(isEpisodeComplete(1079, 1200)).toBe(false));
    it("krótki materiał nie jest ukończony w pozycji zero", () => expect(isEpisodeComplete(0, 30)).toBe(false));
    it("odrzuca nieprawidłową długość", () => expect(isEpisodeComplete(10, 0)).toBe(false));
});
