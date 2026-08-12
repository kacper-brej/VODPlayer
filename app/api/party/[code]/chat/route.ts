import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { postPartyMessage } from "@/lib/party/partyChatService";
import { noStoreJson, partyFailureResponse, partyServerError, readPartyObjectBody } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    if (await consumeWriteRateLimit(gate.user.id, "party-chat", 30, 60)) {
        return NextResponse.json({ error: "Zbyt wiele wiadomości. Zwolnij tempo." }, { status: 429 });
    }

    const payload = await readPartyObjectBody(request, 2048);
    const code = parseStringParam((await context.params).code, 16);
    if (code === null || payload === null) return partyFailureResponse("invalid");

    try {
        const result = await postPartyMessage(gate.user, code, payload.body);
        if (!result.ok) return partyFailureResponse(result.code);
        return noStoreJson({ event: result.event });
    } catch {
        return partyServerError();
    }
};
