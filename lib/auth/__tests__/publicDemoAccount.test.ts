import { describe, expect, it } from "vitest";
import { isPublicDemoAccount } from "@/lib/auth/publicDemoAccount";

describe("publiczne konto demonstracyjne", () => {
    it("rozpoznaje wyłącznie zarezerwowaną nazwę example", () => {
        expect(isPublicDemoAccount({ username: "example" })).toBe(true);
        expect(isPublicDemoAccount({ username: "Example" })).toBe(true);
        expect(isPublicDemoAccount({ username: "viewer" })).toBe(false);
        expect(isPublicDemoAccount(null)).toBe(false);
    });
});
