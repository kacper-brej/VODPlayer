import { NextResponse, type NextRequest } from "next/server";
import { verifyEmail } from "@/lib/auth/accountService";

export const runtime = "nodejs";

export const GET = async (request: NextRequest) => {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const result = token ? await verifyEmail(token) : "invalid";

    return NextResponse.redirect(new URL(`/login?verified=${result === "ok" ? "1" : "0"}`, request.url));
};
