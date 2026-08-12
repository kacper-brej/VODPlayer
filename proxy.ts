import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth/verifySession";
import { isAuthGateDisabled } from "@/lib/auth/authConfig";
import { isSameOriginMutation } from "@/lib/http/requestSecurity";

export default async function proxy(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
        const mutates = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
        const workerEndpoint = request.nextUrl.pathname.startsWith("/api/media/");
        const contentLength = Number(request.headers.get("content-length") ?? "0");
        if (mutates && !workerEndpoint && Number.isFinite(contentLength) && contentLength > 64 * 1024) {
            return NextResponse.json({ error: "Ciało żądania jest zbyt duże." }, { status: 413 });
        }
        if (mutates && !workerEndpoint && !isSameOriginMutation(request)) {
            return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 });
        }
        return NextResponse.next();
    }

    if (isAuthGateDisabled()) {
        return NextResponse.next();
    }

    if (!(await hasValidSession(request))) {
        const loginUrl = new URL("/login", request.nextUrl);
        const { pathname, search } = request.nextUrl;
        if (pathname.startsWith("/watch") || pathname.startsWith("/series")) {
            loginUrl.searchParams.set("returnTo", `${pathname}${search}`);
        }
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("token");
        response.cookies.delete("nx_profile");
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/api/:path*",
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
        "/welcome/:path*",
        "/watch/:path*",
    ],
};
