import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { transferPartyHost, type PartyCoordinationFailure } from "@/lib/party/partyCoordinationService";
import { noStoreJson, partyServerError, readPartyObjectBody } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failureResponse = (code: PartyCoordinationFailure) => {
    if (code === "invalid") return NextResponse.json({ error: "Nieprawidłowy uczestnik." }, { status: 422 });
    if (code === "forbidden") return NextResponse.json({ error: "Tylko host może przekazać rolę." }, { status: 403 });
    if (code === "stale") return NextResponse.json({ error: "Host pokoju już się zmienił." }, { status: 409 });
    return NextResponse.json({ error: "Pokój jest niedostępny." }, { status: 403 });
};

export const POST = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    if (await consumeWriteRateLimit(gate.user.id, "party-host", 30, 900)) {
        return NextResponse.json({ error: "Zbyt wiele prób przekazania hosta." }, { status: 429 });
    }
    const payload = await readPartyObjectBody(request, 1024);
    const code = parseStringParam((await context.params).code, 16);
    const targetProfileId = payload?.targetProfileId;
    if (code === null || !Number.isSafeInteger(targetProfileId) || Number(targetProfileId) < 1) {
        return failureResponse("invalid");
    }
    try {
        const result = await transferPartyHost(gate.user, code, Number(targetProfileId));
        if (!result.ok) return failureResponse(result.code);
        return noStoreJson({ event: result.event });
    } catch {
        return partyServerError();
    }
};
