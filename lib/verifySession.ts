import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

export const hasValidSession = async (request: NextRequest): Promise<boolean> => {
    const token = request.cookies.get("token")?.value;
    if (!token) return false;

    try {
        await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
        return true;
    } catch {
        return false;
    }
};
