import { describe, expect, it } from "vitest";
import { safeReturnPath, watchPath } from "../routes";

describe("safeReturnPath", () => {
    it.each(["//evil.example/x", "https://evil.example/x", "http://evil.example", "/\\evil.example", null])(
        "odrzuca zewnetrzna lub niejednoznaczna sciezke %s",
        (value) => expect(safeReturnPath(value)).toBe("/profiles"),
    );

    it("zachowuje bezpieczna lokalna sciezke z query", () => {
        expect(safeReturnPath("/watch?id=Test&ep=1")).toBe("/watch?id=Test&ep=1");
    });
});

describe("watchPath", () => {
    it("nie eksponuje rozszerzenia legacy dla numerycznego logical key", () => {
        expect(watchPath(1000005, "01.mp4")).toBe("/watch?id=1000005&ep=1");
    });

    it("zachowuje nienumeryczny logical key dla kompatybilnosci", () => {
        expect(watchPath("Test", "OVA.mp4")).toBe("/watch?id=Test&ep=OVA.mp4");
    });
});
