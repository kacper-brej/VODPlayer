import { describe, expect, it } from "vitest";
import {
    DEMO_INTRO_END_SECONDS,
    DEMO_OUTRO_LEAD_SECONDS,
    demoChapters,
} from "@/lib/chapters/demoChapters";

describe("rozdziały materiału demonstracyjnego", () => {
    it("wyliczają outro na minutę przed końcem klipu", () => {
        const chapters = demoChapters(600);
        const outro = chapters.find((chapter) => chapter.type === "outro");

        expect(outro).toEqual({ type: "outro", startSeconds: 600 - DEMO_OUTRO_LEAD_SECONDS, endSeconds: 600 });
    });

    it("pozwala pominąć pierwsze półtorej minuty demo", () => {
        const intro = demoChapters(600).find((chapter) => chapter.type === "intro");

        expect(intro).toEqual({ type: "intro", startSeconds: 0, endSeconds: DEMO_INTRO_END_SECONDS });
    });

    it("krótki klip nie dostaje outro, żeby znacznik nie wypadł na starcie", () => {
        expect(demoChapters(45).map((chapter) => chapter.type)).toEqual(["intro"]);
        expect(demoChapters(DEMO_OUTRO_LEAD_SECONDS).map((chapter) => chapter.type)).toEqual(["intro"]);
        expect(demoChapters(DEMO_OUTRO_LEAD_SECONDS + 1).map((chapter) => chapter.type)).toEqual(["intro", "outro"]);
    });

    it("zaokrągla granice do pełnych sekund", () => {
        const outro = demoChapters(612.4).find((chapter) => chapter.type === "outro");

        expect(outro).toEqual({ type: "outro", startSeconds: 552, endSeconds: 612 });
    });

    it("bez znanego czasu trwania nie zgaduje rozdziałów", () => {
        expect(demoChapters(null)).toEqual([]);
        expect(demoChapters(0)).toEqual([]);
        expect(demoChapters(Number.NaN)).toEqual([]);
    });
});
