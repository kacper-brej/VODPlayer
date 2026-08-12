import { describe, expect, it } from "vitest";
import { deleteB2Prefix } from "../b2AdminStorage";

describe("deleteB2Prefix guard", () => {
    it.each([
        "media/",
        "media/Test/01.mp4",
        "media/Test/../",
        "artwork/Test/01.mp4/",
        "media/Test/01.mp4/../../",
    ])("odrzuca prefix spoza dokładnego katalogu assetu: %s", async (prefix) => {
        await expect(deleteB2Prefix(prefix)).rejects.toThrow("canonical prefix");
    });
});
