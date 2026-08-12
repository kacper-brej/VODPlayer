import { describe, expect, it } from "vitest";
import { decidePreview } from "../previewPolicy";

const base = {
    assetId: 42,
    assetVersion: 7,
    durationSeconds: 1200,
    previewStartSeconds: 30,
    progress: null,
};

describe("decidePreview", () => {
    it("nieogladany uzywa editorial start", () => {
        expect(decidePreview(base)).toMatchObject({ sourceTimelineStartSeconds: 30, reason: "editorial", mediaOffsetSeconds: 0 });
    });

    it("nieogladany bez editorial start uzywa bezpiecznego defaultu", () => {
        expect(decidePreview({ ...base, previewStartSeconds: null })).toMatchObject({ sourceTimelineStartSeconds: 30, reason: "default" });
    });

    it("lastWatch=5 daje 0", () => {
        expect(decidePreview({ ...base, progress: { assetVersion: 7, positionSeconds: 5, durationSeconds: 1200, completed: false } }))
            .toMatchObject({ sourceTimelineStartSeconds: 0, reason: "resume" });
    });

    it("lastWatch=100 daje 90", () => {
        expect(decidePreview({ ...base, progress: { assetVersion: 7, positionSeconds: 100, durationSeconds: 1200, completed: false } }))
            .toMatchObject({ sourceTimelineStartSeconds: 90, reason: "resume" });
    });

    it("completed wraca do editorial zamiast koncowki", () => {
        expect(decidePreview({ ...base, progress: { assetVersion: 7, positionSeconds: 1100, durationSeconds: 1200, completed: true } }))
            .toMatchObject({ sourceTimelineStartSeconds: 30, reason: "completed-fallback" });
    });

    it("pozycja w progu konca wraca do fallbacku nawet przy blednej fladze completed", () => {
        expect(decidePreview({ ...base, progress: { assetVersion: 7, positionSeconds: 1145, durationSeconds: 1200, completed: false } }))
            .toMatchObject({ sourceTimelineStartSeconds: 30, reason: "completed-fallback" });
    });

    it.each([
        { assetVersion: 6, positionSeconds: 100, durationSeconds: 1200, completed: false },
        { assetVersion: 7, positionSeconds: Number.NaN, durationSeconds: 1200, completed: false },
        { assetVersion: 7, positionSeconds: Number.POSITIVE_INFINITY, durationSeconds: 1200, completed: false },
        { assetVersion: 7, positionSeconds: 1300, durationSeconds: 1200, completed: false },
        { assetVersion: 7, positionSeconds: 100, durationSeconds: 800, completed: false },
    ])("stary lub nieprawidlowy progress wraca do fallbacku", (progress) => {
        expect(decidePreview({ ...base, progress })).toMatchObject({ sourceTimelineStartSeconds: 30, reason: "editorial" });
    });

    it("bardzo krotki odcinek jest clampowany do poczatku i swojej dlugosci", () => {
        expect(decidePreview({ ...base, durationSeconds: 5, previewStartSeconds: 30 })).toMatchObject({
            sourceTimelineStartSeconds: 0,
            durationSeconds: 5,
        });
    });

    it("odrzuca nieprawidlowa dlugosc assetu", () => {
        expect(decidePreview({ ...base, durationSeconds: 0 })).toBeNull();
        expect(decidePreview({ ...base, durationSeconds: Number.NaN })).toBeNull();
    });
});
