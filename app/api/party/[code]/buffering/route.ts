import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { reportPartyBuffering, type PartyCoordinationFailure } from "@/lib/party/partyCoordinationService";
import { noStoreJson, partyServerError, readPartyObjectBody } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failureResponse = (code: PartyCoordinationFailure) => {
    if (code === "invalid") return NextResponse.json({ error: "Nieprawidłowy stan buforowania." }, { status: 422 });
    return NextResponse.json({ error: "Pokój jest niedostępny." }, { status: 403 });
};

export const POST = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    if (await consumeWriteRateLimit(gate.user.id, "party-buffering", 180, 900)) {
        return NextResponse.json({ error: "Zbyt wiele zgłoszeń buforowania." }, { status: 429 });
    }
    const payload = await readPartyObjectBody(request, 1024);
    const code = parseStringParam((await context.params).code, 16);
    if (payload === null || code === null) return failureResponse("invalid");
    try {
        const result = await reportPartyBuffering(gate.user, code, {
            buffering: payload.buffering as boolean | undefined,
            reconcile: payload.reconcile === true,
        });
        if (!result.ok) return failureResponse(result.code);
        return noStoreJson({ event: result.event });
    } catch {
        return partyServerError();
    }
};
