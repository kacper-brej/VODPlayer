import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "../tokenHash";

describe("generateToken", () => {
    it("zwraca 64-znakowy hex raw token i jego SHA-256 hash", () => {
        const { raw, hash } = generateToken();
        expect(raw).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).toBe(hashToken(raw));
    });

    it("dwa wywolania daja rozne tokeny", () => {
        expect(generateToken().raw).not.toBe(generateToken().raw);
    });
});

describe("hashToken", () => {
    it("jest deterministyczny", () => {
        expect(hashToken("abc")).toBe(hashToken("abc"));
    });

    it("rozne wejscia daja rozne hashe", () => {
        expect(hashToken("abc")).not.toBe(hashToken("abd"));
    });
});
