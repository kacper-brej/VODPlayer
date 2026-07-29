import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasValidSession } from "@/lib/verifySession";

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/qr-confirm"];
const AUTH_GATE_DISABLED = process.env.DISABLE_AUTH_GATE === "true";

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (AUTH_GATE_DISABLED) {
        return NextResponse.next();
    }

    if (PUBLIC_ROUTES.includes(pathname)) {
        return NextResponse.next();
    }

    if (!(await hasValidSession(request))) {
        return NextResponse.redirect(new URL("/login", request.nextUrl));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api/|_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|svg|webp|woff2?)$).*)"],
};
