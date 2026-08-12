import { describe, expect, it } from "vitest";
import { parseNullableSafeDbInteger, parseSafeDbInteger } from "../integer";

describe("parseSafeDbInteger", () => {
    it("zachowuje dokładną wartość BIGINT zwróconą jako string", () => {
        expect(parseSafeDbInteger("9007199254740991", "asset_id")).toBe(Number.MAX_SAFE_INTEGER);
        expect(parseNullableSafeDbInteger(null, "asset_id")).toBeNull();
    });

    it("odrzuca wartość, której kontrakt number nie potrafi przenieść bez utraty precyzji", () => {
        expect(() => parseSafeDbInteger("9007199254740992", "asset_id")).toThrow(RangeError);
    });
});
