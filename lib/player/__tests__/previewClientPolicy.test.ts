import { describe, expect, it } from "vitest";
import { shouldAllowAutomaticPreview, type AutomaticPreviewEnvironment } from "../previewClientPolicy";

const allowed: AutomaticPreviewEnvironment = {
    autoPreviewsEnabled: true,
    reduceData: false,
    saveData: false,
    reducedMotion: false,
    documentVisible: true,
    finePointer: true,
    intent: "hover",
};

describe("shouldAllowAutomaticPreview", () => {
    it("pozwala na hover przy pełnej zgodzie profilu i urządzenia", () => {
        expect(shouldAllowAutomaticPreview(allowed)).toBe(true);
    });

    it.each([
        ["preferencja profilu", { autoPreviewsEnabled: false }],
        ["reduceData", { reduceData: true }],
        ["Save-Data", { saveData: true }],
        ["reduced motion", { reducedMotion: true }],
        ["ukryta karta", { documentVisible: false }],
    ])("blokuje auto: %s", (_name, patch) => {
        expect(shouldAllowAutomaticPreview({ ...allowed, ...patch })).toBe(false);
    });

    it("nie uruchamia hover bez precyzyjnego wskaźnika, ale pozwala na focus klawiatury", () => {
        expect(shouldAllowAutomaticPreview({ ...allowed, finePointer: false })).toBe(false);
        expect(shouldAllowAutomaticPreview({ ...allowed, finePointer: false, intent: "focus" })).toBe(true);
    });
});
