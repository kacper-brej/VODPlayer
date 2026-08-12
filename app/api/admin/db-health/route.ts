import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import { pingDatabase } from "@/lib/db/healthRepository";
import { getDbMetricsSnapshot } from "@/lib/db/metrics";
import { DatabaseError } from "@/lib/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    try {
        const health = await pingDatabase();
        return NextResponse.json({ ...health, operations: getDbMetricsSnapshot() });
    } catch (error) {
        const status = error instanceof DatabaseError ? error.httpStatus : 500;
        const message = error instanceof DatabaseError ? error.message : "Wystąpił nieoczekiwany błąd serwera.";
        return NextResponse.json({ ok: false, error: message }, { status });
    }
};
