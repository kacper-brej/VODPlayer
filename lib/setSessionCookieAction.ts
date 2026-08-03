"use server"
import { cookies } from "next/headers";
import { jwtVerify, type JWTPayload } from "jose";
import type { AuthUser } from "@/lib/contracts";

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

const SESSION_MAX_AGE = 60 * 60 * 24;
const SESSION_MAX_AGE_REMEMBERED = 60 * 60 * 24 * 30;

// login.php i qr-check.php podpisują sub/username/email w payloadzie — token jest już
// zweryfikowany kryptograficznie poniżej, więc odczytanie usera stąd oszczędza osobne
// zapytanie do me.php przy każdym logowaniu.
const userFromPayload = (payload: JWTPayload): AuthUser | null => {
    const rawId = payload.sub;
    const id = typeof rawId === "number"
        ? rawId
        : typeof rawId === "string" && /^\d+$/.test(rawId)
            ? Number(rawId)
            : null;

    if (id === null || !Number.isSafeInteger(id) || typeof payload.username !== "string" || typeof payload.email !== "string") {
        return null;
    }

    return { id, username: payload.username, email: payload.email };
};

const setSessionCookieAction = async (token: string, rememberMe: boolean): Promise<AuthUser | null> => {
    let payload: JWTPayload;
    try {
        ({ payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] }));
    } catch {
        return null;
    }

    const user = userFromPayload(payload);
    if (!user) return null;

    (await cookies()).set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: rememberMe ? SESSION_MAX_AGE_REMEMBERED : SESSION_MAX_AGE,
    });

    return user;
}

export default setSessionCookieAction;
