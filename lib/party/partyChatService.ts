import "server-only";
import type { AuthUser } from "@/lib/core/contracts";
import { getUserSeriesAccessLevel } from "@/lib/access/entitlements";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import type { PartyChatEvent } from "@/lib/party/partyEvents";
import * as repo from "@/lib/party/partyRepository";
import { normalizeRoomCode } from "@/lib/party/partyService";
import { publishPartyEvent } from "@/lib/party/realtimeChannel";
import { PARTY_MESSAGE_MAX_LENGTH } from "@/lib/party/partyMessageLimits";

export type PartyChatFailure = "invalid" | "unavailable";
export type PartyChatResult =
    | { ok: true; event: PartyChatEvent }
    | { ok: false; code: PartyChatFailure };

export const normalizePartyMessageBody = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    const body = raw.trim();
    return body !== "" && body.length <= PARTY_MESSAGE_MAX_LENGTH ? body : null;
};

export const postPartyMessage = async (
    user: AuthUser,
    rawCode: string,
    rawBody: unknown,
): Promise<PartyChatResult> => {
    const code = normalizeRoomCode(rawCode);
    const body = normalizePartyMessageBody(rawBody);
    if (code === null || body === null) return { ok: false, code: "invalid" };

    const snapshot = await repo.findPartyByCode(code);
    if (snapshot === null) return { ok: false, code: "unavailable" };
    if (await getUserSeriesAccessLevel(user, snapshot.party.seriesKey) !== "full") {
        return { ok: false, code: "unavailable" };
    }

    const profileId = await resolveOwnedProfileId(user.id, user.username);
    if (await repo.findMemberRole(snapshot.party.id, profileId) === null) {
        return { ok: false, code: "unavailable" };
    }

    const messageId = await repo.insertMessage(snapshot.party.id, profileId, body);
    const message = await repo.findMessageById(messageId);
    if (message === null) return { ok: false, code: "unavailable" };

    const event: PartyChatEvent = {
        type: "chat",
        roomCode: code,
        eventAtMs: message.createdAtMs,
        message,
    };

    try {
        await publishPartyEvent(code, { name: event.type, data: event });
    } catch {
        console.error("Nie udało się rozesłać wiadomości czatu pokoju.");
    }

    return { ok: true, event };
};
