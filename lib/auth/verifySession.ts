import "server-only";
import type { NextRequest } from "next/server";
import { verifySessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";

export const hasValidSession = async (request: NextRequest): Promise<boolean> => {
    const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!cookieValue) return false;

    return (await verifySessionCookieValue(cookieValue)) !== null;
};
