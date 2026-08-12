import { describe, expect, it } from "vitest";
import { generatePartyCode, PARTY_CODE_ALPHABET, PARTY_CODE_LENGTH } from "../partyInviteCode";

describe("kod zaproszenia", () => {
    it("ma stałą długość i nie zawiera znaków mylących", () => {
        const code = generatePartyCode();

        expect(code).toHaveLength(PARTY_CODE_LENGTH);
        expect([...code].every((character) => PARTY_CODE_ALPHABET.includes(character))).toBe(true);
        expect(code).not.toMatch(/[01OIL]/u);
    });

    it("nie jest kolejnym identyfikatorem ani stałą wartością", () => {
        const codes = new Set(Array.from({ length: 32 }, () => generatePartyCode()));

        expect(codes.size).toBe(32);
        expect([...codes].every((code) => !/^\d+$/u.test(code))).toBe(true);
    });
});
