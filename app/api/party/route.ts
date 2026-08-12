import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { createPartyRoom } from "@/lib/party/partyLifecycleService";
import { noStoreJson, partyFailureResponse, partyServerError, readPartyObjectBody } from "./partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    if (await consumeWriteRateLimit(user.id, "party-create", 10, 900)) {
        return NextResponse.json({ error: "Zbyt wiele prób utworzenia pokoju." }, { status: 429 });
    }

    const payload = await readPartyObjectBody(request);
    const seriesKey = typeof payload?.series_key === "string" ? payload.series_key : "";
    const episodeKey = typeof payload?.episode_key === "string" ? payload.episode_key : "";

    try {
        const result = await createPartyRoom(user, { seriesKey, episodeKey });
        if (!result.ok) return partyFailureResponse(result.code);
        return noStoreJson({ code: result.value.code, room: result.value }, 201);
    } catch {
        return partyServerError();
    }
};
