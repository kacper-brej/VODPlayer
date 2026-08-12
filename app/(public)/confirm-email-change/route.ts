import { NextResponse, type NextRequest } from "next/server";
import { confirmEmailChange } from "@/lib/auth/accountService";

export const runtime = "nodejs";

export const GET = async (request: NextRequest) => {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const result = token ? await confirmEmailChange(token) : "invalid";

    if (result === "ok") {
        return NextResponse.redirect(new URL("/settings?email_changed=1", request.url));
    }
    if (result === "taken") {
        return NextResponse.redirect(new URL("/settings?email_changed=0&reason=taken", request.url));
    }
    return NextResponse.redirect(new URL("/settings?email_changed=0", request.url));
};
