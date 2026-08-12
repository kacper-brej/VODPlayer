import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { parseStringParam } from "@/lib/http/routeParams";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import { findMemberRole, findPartyByCode } from "@/lib/party/partyRepository";
import { isPartyAlive, normalizeRoomCode } from "@/lib/party/partyService";
import { issueChannelToken, PartyChannelError } from "@/lib/party/realtimeChannel";
import { getUserSeriesAccessLevel } from "@/lib/access/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unavailable = () => NextResponse.json({ error: "Pokój jest niedostępny." }, { status: 404 });

export const POST = async (_request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    if (await consumeWriteRateLimit(user.id, "party-token", 60, 900)) {
        return NextResponse.json({ error: "Zbyt wiele prób dołączenia do kanału." }, { status: 429 });
    }

    const rawCode = parseStringParam((await context.params).code, 16);
    const code = rawCode === null ? null : normalizeRoomCode(rawCode);
    if (code === null) return unavailable();

    try {
        const snapshot = await findPartyByCode(code);
        if (!snapshot || !isPartyAlive(snapshot.party, snapshot.serverNowMs)) return unavailable();
        if (await getUserSeriesAccessLevel(user, snapshot.party.seriesKey) !== "full") return unavailable();

        const profileId = await resolveOwnedProfileId(user.id, user.username);
        const role = await findMemberRole(snapshot.party.id, profileId);
        if (role === null) return unavailable();

        const grant = await issueChannelToken(snapshot.party.roomCode);

        return NextResponse.json(
            { streamUrl: grant.streamUrl, expiresAtMs: grant.expiresAtMs },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        if (error instanceof PartyChannelError) {
            return NextResponse.json({ error: error.message }, { status: error.httpStatus });
        }
        return NextResponse.json({ error: "Nie udało się otworzyć kanału pokoju." }, { status: 500 });
    }
};
