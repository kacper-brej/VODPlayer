import { afterEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET = "test-only-session-secret-not-used-anywhere-real";
const validSessionSecret = process.env.SESSION_SECRET;

afterEach(() => { process.env.SESSION_SECRET = validSessionSecret; });

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };

vi.mock("next/headers", () => ({
    cookies: async () => cookieStore,
}));

const {
    mintSessionCookieValue,
    verifySessionCookieValue,
    setSessionCookie,
    clearSessionCookie,
    readSessionCookieValue,
    SESSION_COOKIE_NAME,
    SESSION_TOKEN_AUDIENCE,
    SESSION_TOKEN_ISSUER,
    SESSION_TOKEN_TYPE,
} = await import("../sessionCookie");

describe("mint/verify roundtrip", () => {
    it("nie podpisuje sesji bez sekretu ani z sekretem krótszym niż 32 bajty", async () => {
        delete process.env.SESSION_SECRET;
        await expect(mintSessionCookieValue("sid", 3600)).rejects.toThrow("SESSION_SECRET");
        process.env.SESSION_SECRET = "too-short";
        await expect(mintSessionCookieValue("sid", 3600)).rejects.toThrow("32 bajty");
    });

    it("verifySessionCookieValue odczytuje dokladnie ten sam sid, ktory zostal zamintowany", async () => {
        const value = await mintSessionCookieValue("raw-session-token-123", 3600);
        await expect(verifySessionCookieValue(value)).resolves.toBe("raw-session-token-123");
    });

    it("odrzuca token podpisany innym sekretem (proba sfalszowania)", async () => {
        const { SignJWT } = await import("jose");
        const foreignKey = new TextEncoder().encode("zupelnie-inny-sekret");
        const forged = await new SignJWT({ sid: "raw-session-token-123" })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
            .sign(foreignKey);

        await expect(verifySessionCookieValue(forged)).resolves.toBeNull();
    });

    it("odrzuca wygasly token", async () => {
        const value = await mintSessionCookieValue("raw-session-token-123", -10);
        await expect(verifySessionCookieValue(value)).resolves.toBeNull();
    });

    it("odrzuca błędne issuer, audience i typ tokenu", async () => {
        const { SignJWT } = await import("jose");
        const key = new TextEncoder().encode(validSessionSecret);
        const build = (issuer: string, audience: string, tokenType: string) => new SignJWT({ sid: "sid", tokenType })
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .setIssuer(issuer)
            .setAudience(audience)
            .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
            .sign(key);

        await expect(verifySessionCookieValue(await build("other", SESSION_TOKEN_AUDIENCE, SESSION_TOKEN_TYPE)))
            .resolves.toBeNull();
        await expect(verifySessionCookieValue(await build(SESSION_TOKEN_ISSUER, "other", SESSION_TOKEN_TYPE)))
            .resolves.toBeNull();
        await expect(verifySessionCookieValue(await build(SESSION_TOKEN_ISSUER, SESSION_TOKEN_AUDIENCE, "other")))
            .resolves.toBeNull();
    });

    it("odrzuca inny algorytm i brak chronionego typ=JWT", async () => {
        const { SignJWT } = await import("jose");
        const key = new TextEncoder().encode(validSessionSecret);
        const claims = { sid: "sid", tokenType: SESSION_TOKEN_TYPE };
        const hs384 = await new SignJWT(claims)
            .setProtectedHeader({ alg: "HS384", typ: "JWT" })
            .setIssuer(SESSION_TOKEN_ISSUER)
            .setAudience(SESSION_TOKEN_AUDIENCE)
            .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
            .sign(key);
        const missingHeaderType = await new SignJWT(claims)
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer(SESSION_TOKEN_ISSUER)
            .setAudience(SESSION_TOKEN_AUDIENCE)
            .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
            .sign(key);

        await expect(verifySessionCookieValue(hs384)).resolves.toBeNull();
        await expect(verifySessionCookieValue(missingHeaderType)).resolves.toBeNull();
    });

    it("odrzuca kompletnie losowy string", async () => {
        await expect(verifySessionCookieValue("not-a-jwt-at-all")).resolves.toBeNull();
    });
});

describe("cookie store", () => {
    it("setSessionCookie ustawia httpOnly/sameSite=lax/path=/", async () => {
        await setSessionCookie("some-jwt-value", 3600);
        expect(cookieStore.set).toHaveBeenCalledWith(
            SESSION_COOKIE_NAME,
            "some-jwt-value",
            expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600 }),
        );
    });

    it("clearSessionCookie usuwa ciasteczko po nazwie", async () => {
        await clearSessionCookie();
        expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    });

    it("readSessionCookieValue zwraca null gdy brak ciasteczka", async () => {
        cookieStore.get.mockReturnValueOnce(undefined);
        await expect(readSessionCookieValue()).resolves.toBeNull();
    });
});
