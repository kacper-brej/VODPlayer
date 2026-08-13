import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { publishPartyTyping } from "@/lib/party/partyChatService";
import { noStoreJson, partyFailureResponse, partyServerError } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (_request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    if (await consumeWriteRateLimit(gate.user.id, "party-typing", 120, 60)) {
        return NextResponse.json({ error: "Zbyt wiele sygnałów pisania." }, { status: 429 });
    }

    const code = parseStringParam((await context.params).code, 16);
    if (code === null) return partyFailureResponse("invalid");

    try {
        const result = await publishPartyTyping(gate.user, code);
        if (!result.ok) return partyFailureResponse(result.code);
        return noStoreJson({ ok: true });
    } catch {
        return partyServerError();
    }
};
