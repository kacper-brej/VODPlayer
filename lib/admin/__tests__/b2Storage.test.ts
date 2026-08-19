import { describe, expect, it } from "vitest";
import {
    estimateB2MonthlyStorageCostUsd,
    formatB2Bytes,
    getB2FreeTierUsedPercent,
} from "../b2Storage";

describe("metryki magazynu B2", () => {
    it("formatuje rozliczeniowe jednostki dziesiętne", () => {
        expect(formatB2Bytes(9_504_112_474)).toBe("9.5 GB");
        expect(formatB2Bytes(950_000_000)).toBe("950.0 MB");
    });

    it("odejmuje darmowe 10 GB przed oszacowaniem kosztu", () => {
        expect(estimateB2MonthlyStorageCostUsd(9_504_112_474)).toBe(0);
        expect(estimateB2MonthlyStorageCostUsd(11_000_000_000)).toBeCloseTo(0.00695);
    });

    it("liczy wykorzystanie darmowego limitu i ogranicza wynik do 100 procent", () => {
        expect(getB2FreeTierUsedPercent(9_504_112_474)).toBe(95);
        expect(getB2FreeTierUsedPercent(20_000_000_000)).toBe(100);
    });
});
