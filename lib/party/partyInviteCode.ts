import "server-only";
import { randomBytes } from "node:crypto";

export const PARTY_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PARTY_CODE_LENGTH = 12;

export const generatePartyCode = (): string => {
    const alphabetLength = PARTY_CODE_ALPHABET.length;
    const acceptedByteRange = Math.floor(256 / alphabetLength) * alphabetLength;
    let code = "";

    while (code.length < PARTY_CODE_LENGTH) {
        for (const byte of randomBytes(PARTY_CODE_LENGTH)) {
            if (byte >= acceptedByteRange) continue;
            code += PARTY_CODE_ALPHABET[byte % alphabetLength];
            if (code.length === PARTY_CODE_LENGTH) break;
        }
    }

    return code;
};
