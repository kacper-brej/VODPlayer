import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);
const VOD_ORIGIN = process.env.NEXT_PUBLIC_VOD_ORIGIN ?? "https://vids.kacper-brej.pl";
const SESSION_CHECK_TIMEOUT_MS = 3000;

export const hasValidSession = async (request: NextRequest): Promise<boolean> => {
    const token = request.cookies.get("token")?.value;
    if (!token) return false;

    try {
        await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
        return true;
    } catch (error) {
        console.error("[hasValidSession] local jwtVerify failed:", error);
        return false;
    }
};

export const hasActiveSession = async (request: NextRequest): Promise<boolean> => {
    if (!(await hasValidSession(request))) return false;

    const token = request.cookies.get("token")?.value;
    if (!token) return false;

    try {
        const response = await fetch(`${VOD_ORIGIN}/me.php`, {
            headers: { "X-Auth-Token": token, Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "<no body>");
            console.error(`[hasValidSession] me.php -> ${response.status}:`, body);
        }

        return response.ok;
    } catch (error) {
        console.error("[hasActiveSession] me.php fetch failed:", error);
        return false;
    }
};
