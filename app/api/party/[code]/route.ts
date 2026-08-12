import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { getPartyRoomState } from "@/lib/party/partyLifecycleService";
import { noStoreJson, partyFailureResponse, partyServerError } from "../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (_request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    const code = parseStringParam((await context.params).code, 16);
    if (code === null) return partyFailureResponse("unavailable");

    try {
        const result = await getPartyRoomState(gate.user, code);
        if (!result.ok) return partyFailureResponse(result.code);
        return noStoreJson({ room: result.value });
    } catch {
        return partyServerError();
    }
};
