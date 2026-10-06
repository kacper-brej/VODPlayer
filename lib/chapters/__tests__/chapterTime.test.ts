import { describe, expect, it } from "vitest";
import { formatChapterTime, parseChapterTime } from "../chapterTime";

describe("czas wpisywany w panelu", () => {
    it.each([["00:00", 0], ["1:30", 90], [" 01:30 ", 90], ["60:00", 3600], ["1:05:20", 3920], ["123:45", 7425]])("przelicza %s na %s sekund dla API", (input, expected) => {
        expect(parseChapterTime(String(input))).toBe(expected);
    });
    it.each(["", "90", "1.5", "-1:30", "01:60", "1:60:00", "01:2", "1:02:99", "1:2:03", "999999:00:00"])("odrzuca niejednoznaczny lub nieprawidłowy czas %s", (input) => {
        expect(parseChapterTime(input)).toBeNull();
    });
    it.each([0, 1, 59, 60, 90, 3599, 3600, 10000, 999999])("zachowuje zapisany czas %s przy ponownej edycji", (seconds) => {
        expect(parseChapterTime(formatChapterTime(seconds))).toBe(seconds);
    });
});
