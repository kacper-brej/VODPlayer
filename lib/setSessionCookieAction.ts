"use server"
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

const SESSION_MAX_AGE = 60 * 60 * 24;
const SESSION_MAX_AGE_REMEMBERED = 60 * 60 * 24 * 30;

const setSessionCookieAction = async (token: string, rememberMe: boolean): Promise<void> => {
    try {
        await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    } catch {
        return;
    }

    (await cookies()).set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: rememberMe ? SESSION_MAX_AGE_REMEMBERED : SESSION_MAX_AGE,
    });
}

export default setSessionCookieAction;
