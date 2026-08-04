import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasValidSession } from "@/lib/verifySession";

const AUTH_GATE_DISABLED = process.env.DISABLE_AUTH_GATE === "true";

export default async function proxy(request: NextRequest) {
    if (AUTH_GATE_DISABLED) {
        return NextResponse.next();
    }

    if (!(await hasValidSession(request))) {
        const response = NextResponse.redirect(new URL("/login", request.nextUrl));
        response.cookies.delete("token");
        response.cookies.delete("nx_profile");
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/",
        "/admin/:path*",
        "/collections/:path*",
        "/continue/:path*",
        "/downloads/:path*",
        "/explore/:path*",
        "/favourites/:path*",
        "/genres/:path*",
        "/profiles/:path*",
        "/recent/:path*",
        "/series/:path*",
        "/settings/:path*",
        "/upload/:path*",
        "/watch/:path*",
    ],
};
