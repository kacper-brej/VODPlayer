import { NextResponse } from "next/server";

const configuredApplicationOrigin = (): string | null => {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!raw) return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
    try { return new URL(raw).origin; } catch { return null; }
};

export const isSameOriginMutation = (request: Request): boolean => {
    const origin = request.headers.get("origin");
    const expectedOrigin = configuredApplicationOrigin();
    if (!origin || !expectedOrigin) return false;
    try { return new URL(origin).origin === expectedOrigin; } catch { return false; }
};

export const rejectCrossSiteMutation = (request: Request): NextResponse | null =>
    isSameOriginMutation(request)
        ? null
        : NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403 });
