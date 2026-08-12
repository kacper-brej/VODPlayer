import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { savePartyTelemetry } from "@/lib/party/partyTelemetryService";
import { noStoreJson, partyServerError, readPartyObjectBody } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    if (await consumeWriteRateLimit(gate.user.id, "party-telemetry", 30, 900)) {
        return NextResponse.json({ error: "Limit telemetrii został przekroczony." }, { status: 429 });
    }
    const payload = await readPartyObjectBody(request, 2048);
    const code = parseStringParam((await context.params).code, 16);
    if (payload === null || code === null || !Array.isArray(payload.driftBuckets)) {
        return NextResponse.json({ error: "Nieprawidłowa telemetria." }, { status: 422 });
    }
    try {
        const saved = await savePartyTelemetry(gate.user, code, {
            sessionId: String(payload.sessionId ?? ""),
            driftBuckets: payload.driftBuckets as [number, number, number, number, number],
            hardSeeks: Number(payload.hardSeeks),
            timeToSyncMs: payload.timeToSyncMs === null ? null : Number(payload.timeToSyncMs),
        });
        if (!saved) return NextResponse.json({ error: "Nieprawidłowa telemetria." }, { status: 422 });
        return noStoreJson({ success: true });
    } catch {
        return partyServerError();
    }
};
