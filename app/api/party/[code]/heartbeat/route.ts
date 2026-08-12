import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { heartbeatPartyRoom } from "@/lib/party/partyLifecycleService";
import { noStoreJson, partyFailureResponse, partyServerError, readPartyObjectBody } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    if (await consumeWriteRateLimit(gate.user.id, "party-heartbeat", 120, 900)) {
        return NextResponse.json({ error: "Zbyt wiele sygnałów obecności." }, { status: 429 });
    }
    if (await readPartyObjectBody(request, 1024) === null) return partyFailureResponse("invalid");

    const code = parseStringParam((await context.params).code, 16);
    if (code === null) return partyFailureResponse("unavailable");

    try {
        const result = await heartbeatPartyRoom(gate.user, code);
        if (!result.ok) return partyFailureResponse(result.code);
        return noStoreJson({
            serverNowMs: result.value.serverNowMs,
            expiresAtMs: result.value.expiresAtMs,
        });
    } catch {
        return partyServerError();
    }
};
