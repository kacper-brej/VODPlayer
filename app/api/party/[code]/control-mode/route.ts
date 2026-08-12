import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { changePartyControlMode } from "@/lib/party/partyCoordinationService";
import { noStoreJson, partyServerError, readPartyObjectBody } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    if (await consumeWriteRateLimit(gate.user.id, "party-control-mode", 30, 900)) {
        return NextResponse.json({ error: "Zbyt wiele zmian trybu sterowania." }, { status: 429 });
    }
    const payload = await readPartyObjectBody(request, 1024);
    const code = parseStringParam((await context.params).code, 16);
    const controlMode = payload?.controlMode;
    if (code === null || (controlMode !== "host" && controlMode !== "everyone")) {
        return NextResponse.json({ error: "Nieprawidłowy tryb sterowania." }, { status: 422 });
    }
    try {
        const result = await changePartyControlMode(gate.user, code, controlMode);
        if (!result.ok) {
            const status = result.code === "stale" ? 409 : result.code === "invalid" ? 422 : 403;
            return NextResponse.json({ error: "Nie udało się zmienić trybu sterowania." }, { status });
        }
        return noStoreJson({ event: result.event });
    } catch {
        return partyServerError();
    }
};
