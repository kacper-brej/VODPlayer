import "server-only";
import type { AuthUser } from "@/lib/core/contracts";
import { getUserSeriesAccessLevel } from "@/lib/access/entitlements";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import type { PartyChatEvent, PartyTypingEvent } from "@/lib/party/partyEvents";
import * as repo from "@/lib/party/partyRepository";
import { normalizeRoomCode } from "@/lib/party/partyService";
import { isPartyStorageKey, normalizePartyAttachment } from "@/lib/party/partyAttachment";
import { publishPartyEvent } from "@/lib/party/realtimeChannel";
import { PARTY_MESSAGE_MAX_LENGTH } from "@/lib/party/partyMessageLimits";

export type PartyChatFailure = "invalid" | "unavailable";
export type PartyChatResult =
    | { ok: true; event: PartyChatEvent }
    | { ok: false; code: PartyChatFailure };
export type PartyTypingResult =
    | { ok: true }
    | { ok: false; code: PartyChatFailure };

export const normalizePartyMessageBody = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    const body = raw.trim();
    return body !== "" && body.length <= PARTY_MESSAGE_MAX_LENGTH ? body : null;
};

const resolveMember = async (
    user: AuthUser,
    code: string,
): Promise<{ partyId: number; profileId: number } | null> => {
    const snapshot = await repo.findPartyByCode(code);
    if (snapshot === null) return null;
    if (await getUserSeriesAccessLevel(user, snapshot.party.seriesKey) !== "full") return null;
    const profileId = await resolveOwnedProfileId(user.id, user.username);
    if (await repo.findMemberRole(snapshot.party.id, profileId) === null) return null;
    return { partyId: snapshot.party.id, profileId };
};

export const postPartyMessage = async (
    user: AuthUser,
    rawCode: string,
    rawBody: unknown,
    rawAttachment: unknown = null,
): Promise<PartyChatResult> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null) return { ok: false, code: "invalid" };

    const attachment = rawAttachment === null || rawAttachment === undefined
        ? null
        : normalizePartyAttachment(rawAttachment);
    if (rawAttachment !== null && rawAttachment !== undefined && attachment === null) {
        return { ok: false, code: "invalid" };
    }
    if (attachment !== null && isPartyStorageKey(attachment.url) && attachment.url.split("/")[1] !== code) {
        return { ok: false, code: "invalid" };
    }

    const body = normalizePartyMessageBody(rawBody);
    if (body === null && attachment === null) return { ok: false, code: "invalid" };

    const member = await resolveMember(user, code);
    if (member === null) return { ok: false, code: "unavailable" };

    const messageId = await repo.insertMessage(member.partyId, member.profileId, body ?? "", attachment);
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

export const publishPartyTyping = async (
    user: AuthUser,
    rawCode: string,
): Promise<PartyTypingResult> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null) return { ok: false, code: "invalid" };

    const member = await resolveMember(user, code);
    if (member === null) return { ok: false, code: "unavailable" };

    const event: PartyTypingEvent = {
        type: "typing",
        roomCode: code,
        eventAtMs: Date.now(),
        profileId: member.profileId,
    };

    try {
        await publishPartyEvent(code, { name: event.type, data: event });
    } catch {
        return { ok: false, code: "unavailable" };
    }

    return { ok: true };
};
