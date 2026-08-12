import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { readSessionSecret } from "@/lib/auth/authConfig";

export const SESSION_COOKIE_NAME = "token";
export const SESSION_TOKEN_ISSUER = "nocturna";
export const SESSION_TOKEN_AUDIENCE = "nocturna-web";
export const SESSION_TOKEN_TYPE = "session";

const sessionSecretKey = (): Uint8Array => new TextEncoder().encode(readSessionSecret());

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
export const SESSION_MAX_AGE_REMEMBERED_SECONDS = 60 * 60 * 24 * 30;

export const mintSessionCookieValue = async (rawSessionToken: string, maxAgeSeconds: number): Promise<string> =>
    new SignJWT({ sid: rawSessionToken, tokenType: SESSION_TOKEN_TYPE })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuer(SESSION_TOKEN_ISSUER)
        .setAudience(SESSION_TOKEN_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
        .sign(sessionSecretKey());

export const verifySessionCookieValue = async (cookieValue: string): Promise<string | null> => {
    const secretKey = sessionSecretKey();
    try {
        const { payload, protectedHeader } = await jwtVerify(cookieValue, secretKey, {
            algorithms: ["HS256"],
            issuer: SESSION_TOKEN_ISSUER,
            audience: SESSION_TOKEN_AUDIENCE,
        });
        return protectedHeader.typ === "JWT"
            && payload.tokenType === SESSION_TOKEN_TYPE
            && typeof payload.sid === "string"
            ? payload.sid
            : null;
    } catch {
        return null;
    }
};

export const setSessionCookie = async (cookieValue: string, maxAgeSeconds: number): Promise<void> => {
    (await cookies()).set(SESSION_COOKIE_NAME, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeSeconds,
    });
};

export const clearSessionCookie = async (): Promise<void> => {
    (await cookies()).delete(SESSION_COOKIE_NAME);
};

export const readSessionCookieValue = async (): Promise<string | null> =>
    (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
