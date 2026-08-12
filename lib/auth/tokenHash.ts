import "server-only";
import { randomBytes, createHash } from "node:crypto";

export interface GeneratedToken {
    raw: string;
    hash: string;
}

export const hashToken = (rawToken: string): string => createHash("sha256").update(rawToken).digest("hex");

export const generateToken = (): GeneratedToken => {
    const raw = randomBytes(32).toString("hex");
    return { raw, hash: hashToken(raw) };
};
