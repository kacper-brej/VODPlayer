import { NextResponse } from "next/server";
import { validateWatchPartyCommand } from "@/lib/core/contracts";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { applyPartyCommand } from "@/lib/party/partyCommandService";
import { noStoreJson, partyServerError, readPartyObjectBody } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commandFailure = (code: "invalid" | "unavailable" | "forbidden" | "stale") => {
    if (code === "invalid") {
        return NextResponse.json({ error: "Nieprawidłowa komenda pokoju." }, { status: 422 });
    }
    if (code === "forbidden") {
        return NextResponse.json({ error: "Tylko host może sterować pokojem." }, { status: 403 });
    }
    if (code === "stale") {
        return NextResponse.json({ error: "Stan pokoju zmienił się. Pobierz go ponownie." }, { status: 409 });
    }
    return NextResponse.json({ error: "Pokój jest niedostępny." }, { status: 403 });
};

export const POST = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    if (await consumeWriteRateLimit(gate.user.id, "party-command", 120, 900)) {
        return NextResponse.json({ error: "Zbyt wiele komend pokoju." }, { status: 429 });
    }

    const payload = await readPartyObjectBody(request);
    const code = parseStringParam((await context.params).code, 16);
    const expectedVersion = payload?.expectedVersion;
    const command = validateWatchPartyCommand(payload?.command);
    if (code === null || !command.ok || !Number.isSafeInteger(expectedVersion) || Number(expectedVersion) < 0) {
        return commandFailure("invalid");
    }

    try {
        const result = await applyPartyCommand(gate.user, code, command.data, Number(expectedVersion));
        if (!result.ok && result.code === "stale") return noStoreJson({ room: result.room, conflict: true });
        if (!result.ok) return commandFailure(result.code);
        return noStoreJson({ event: result.event });
    } catch {
        return partyServerError();
    }
};
