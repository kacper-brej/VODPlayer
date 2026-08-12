import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { AuthUser, WatchPartyMember, WatchPartyRoomState, WatchPartySnapshot } from "@/lib/core/contracts";
import { getUserSeriesAccessLevel } from "@/lib/access/entitlements";
import { DatabaseError } from "@/lib/db/errors";
import { withTransaction } from "@/lib/db/transaction";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import { generatePartyCode } from "@/lib/party/partyInviteCode";
import { PARTY_MESSAGE_HISTORY_LIMIT } from "@/lib/party/partyMessageLimits";
import * as repo from "@/lib/party/partyRepository";
import { isPartyAlive, normalizeRoomCode, PARTY_MEMBER_TIMEOUT_MS } from "@/lib/party/partyService";
import { publishPartyEvent } from "@/lib/party/realtimeChannel";
import type { PartyEvent } from "@/lib/party/partyEvents";

const MAX_KEY_LENGTH = 255;
const CREATE_ATTEMPTS = 6;

export type PartyLifecycleFailure = "invalid" | "forbidden" | "unavailable";
export type PartyLifecycleResult<T> = { ok: true; value: T } | { ok: false; code: PartyLifecycleFailure };

const normalizeKey = (value: string): string | null => {
    const key = value.trim();
    return key !== "" && key.length <= MAX_KEY_LENGTH ? key : null;
};

const roomState = (
    snapshot: WatchPartySnapshot,
    participants: WatchPartyMember[],
    viewerProfileId?: number,
): WatchPartyRoomState => ({
    code: snapshot.party.roomCode,
    hostProfileId: snapshot.party.hostProfileId,
    viewerRole: viewerProfileId === undefined
        ? undefined
        : participants.find((participant) => participant.profileId === viewerProfileId)?.role,
    viewerProfileId,
    currentEpisode: {
        seriesKey: snapshot.party.seriesKey,
        episodeKey: snapshot.party.episodeKey,
    },
    controlMode: snapshot.party.controlMode,
    anchor: snapshot.party.anchor,
    bufferingWait: snapshot.party.bufferingWait ?? null,
    participants,
    serverNowMs: snapshot.serverNowMs,
    expiresAtMs: snapshot.party.expiresAtMs,
    closedAtMs: snapshot.party.closedAtMs,
});

const publishComposition = async (event: PartyEvent): Promise<void> => {
    try {
        await publishPartyEvent(event.roomCode, { name: event.type, data: event });
    } catch {
        console.error("Nie udało się rozesłać zmiany składu pokoju.");
    }
};

const loadLockedParty = (
    code: string,
    connection: PoolConnection,
): Promise<WatchPartySnapshot | null> => repo.findPartyByCodeForUpdate(code, connection);

const resolveRoomProfile = (user: AuthUser): Promise<number> =>
    resolveOwnedProfileId(user.id, user.username);

const hasFullAccess = async (user: AuthUser, seriesKey: string): Promise<boolean> =>
    await getUserSeriesAccessLevel(user, seriesKey) === "full";

export const createPartyRoom = async (
    user: AuthUser,
    input: { seriesKey: string; episodeKey: string },
    generateCode: () => string = generatePartyCode,
): Promise<PartyLifecycleResult<WatchPartyRoomState>> => {
    const seriesKey = normalizeKey(input.seriesKey);
    const episodeKey = normalizeKey(input.episodeKey);
    if (seriesKey === null || episodeKey === null) return { ok: false, code: "invalid" };
    if (!await hasFullAccess(user, seriesKey)) return { ok: false, code: "forbidden" };
    if (!await repo.hasReadyPartyEpisode(seriesKey, episodeKey)) return { ok: false, code: "invalid" };

    const profileId = await resolveRoomProfile(user);

    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
        const code = generateCode();
        if (normalizeRoomCode(code) !== code) throw new Error("Generator zwrócił nieprawidłowy kod pokoju.");

        try {
            const state = await withTransaction(async (connection) => {
                const partyId = await repo.createParty({
                    roomCode: code,
                    hostProfileId: profileId,
                    seriesKey,
                    episodeKey,
                }, connection);
                await repo.joinParty(partyId, profileId, "host", connection);
                const snapshot = await repo.findPartyById(partyId, connection);
                if (snapshot === null) throw new Error("Nie udało się odczytać utworzonego pokoju.");
                const participants = await repo.listMembers(partyId, connection);
                return roomState(snapshot, participants, profileId);
            });
            return { ok: true, value: state };
        } catch (error) {
            if (error instanceof DatabaseError && error.code === "conflict" && attempt + 1 < CREATE_ATTEMPTS) continue;
            throw error;
        }
    }

    throw new Error("Nie udało się wygenerować unikalnego kodu pokoju.");
};

export const joinPartyRoom = async (
    user: AuthUser,
    rawCode: string,
): Promise<PartyLifecycleResult<WatchPartyRoomState>> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null) return { ok: false, code: "unavailable" };

    const candidate = await repo.findPartyByCode(code);
    if (candidate === null || !isPartyAlive(candidate.party, candidate.serverNowMs)) {
        return { ok: false, code: "unavailable" };
    }
    if (!await hasFullAccess(user, candidate.party.seriesKey)) return { ok: false, code: "unavailable" };

    const profileId = await resolveRoomProfile(user);
    const joined = await withTransaction(async (connection) => {
        const snapshot = await loadLockedParty(code, connection);
        if (snapshot === null || !isPartyAlive(snapshot.party, snapshot.serverNowMs)) return null;
        const previousRole = await repo.findMemberRole(snapshot.party.id, profileId, connection);
        const role = snapshot.party.hostProfileId === profileId ? "host" : "guest";
        await repo.joinParty(snapshot.party.id, profileId, role, connection);
        const refreshed = await repo.findPartyById(snapshot.party.id, connection);
        if (refreshed === null) return null;
        const participants = await repo.listMembers(snapshot.party.id, connection);
        return { state: roomState(refreshed, participants, profileId), isNew: previousRole === null };
    });

    if (joined === null) return { ok: false, code: "unavailable" };
    if (joined.isNew) {
        await publishComposition({
            type: "member-joined",
            roomCode: code,
            eventAtMs: joined.state.serverNowMs,
            participants: joined.state.participants,
        });
    }
    return { ok: true, value: joined.state };
};

export const leavePartyRoom = async (
    user: AuthUser,
    rawCode: string,
): Promise<PartyLifecycleResult<WatchPartyRoomState>> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null) return { ok: false, code: "unavailable" };
    const profileId = await resolveRoomProfile(user);

    const left = await withTransaction(async (connection) => {
        const snapshot = await loadLockedParty(code, connection);
        if (snapshot === null) return null;
        const role = await repo.findMemberRole(snapshot.party.id, profileId, connection);
        if (role === null) return null;

        const participantsBeforeLeave = await repo.listMembers(snapshot.party.id, connection);
        const successor = role === "host"
            ? participantsBeforeLeave.find((participant) => participant.profileId !== profileId)
            : undefined;
        if (role === "host" && successor) {
            if (!await repo.transferPartyHost(snapshot.party.id, profileId, successor.profileId, connection)) return null;
            await repo.leaveParty(snapshot.party.id, profileId, connection);
        } else if (role === "host") {
            await repo.closeParty(snapshot.party.id, connection);
        } else {
            await repo.leaveParty(snapshot.party.id, profileId, connection);
        }

        const refreshed = await repo.findPartyById(snapshot.party.id, connection);
        if (refreshed === null) return null;
        const participants = await repo.listMembers(snapshot.party.id, connection);
        return { state: roomState(refreshed, participants, profileId), role, successorProfileId: successor?.profileId ?? null };
    });

    if (left === null) return { ok: false, code: "unavailable" };
    if (left.successorProfileId !== null) {
        await publishComposition({
            type: "host-changed",
            roomCode: code,
            eventAtMs: left.state.serverNowMs,
            hostProfileId: left.successorProfileId,
            participants: left.state.participants,
        });
    } else if (left.role === "host") {
        await publishComposition({
            type: "party-closed",
            roomCode: code,
            eventAtMs: left.state.serverNowMs,
            closedAtMs: left.state.closedAtMs ?? left.state.serverNowMs,
            participants: left.state.participants,
        });
    } else {
        await publishComposition({
            type: "member-left",
            roomCode: code,
            eventAtMs: left.state.serverNowMs,
            profileId,
            participants: left.state.participants,
        });
    }
    return { ok: true, value: left.state };
};

export const heartbeatPartyRoom = async (
    user: AuthUser,
    rawCode: string,
): Promise<PartyLifecycleResult<WatchPartyRoomState>> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null) return { ok: false, code: "unavailable" };

    const candidate = await repo.findPartyByCode(code);
    if (candidate === null || !isPartyAlive(candidate.party, candidate.serverNowMs)) {
        return { ok: false, code: "unavailable" };
    }
    if (!await hasFullAccess(user, candidate.party.seriesKey)) return { ok: false, code: "unavailable" };
    const profileId = await resolveRoomProfile(user);

    const heartbeat = await withTransaction(async (connection) => {
        const snapshot = await loadLockedParty(code, connection);
        if (snapshot === null || !isPartyAlive(snapshot.party, snapshot.serverNowMs)) return null;
        const role = await repo.findMemberRole(snapshot.party.id, profileId, connection);
        if (role === null) return null;
        if (!await repo.heartbeatMember(snapshot.party.id, profileId, connection)) return null;
        const staleMembers = await repo.listStaleMembers(
            snapshot.party.id,
            Math.ceil(PARTY_MEMBER_TIMEOUT_MS / 1000),
            connection,
        );
        const staleProfileIds = staleMembers.map((member) => member.profileId);
        const hostStale = staleMembers.some((member) => member.role === "host");
        const participantsBeforeCleanup = await repo.listMembers(snapshot.party.id, connection);
        const successor = hostStale
            ? participantsBeforeCleanup.find((participant) => !staleProfileIds.includes(participant.profileId))
            : undefined;
        if (hostStale && successor) {
            if (!await repo.transferPartyHost(
                snapshot.party.id,
                snapshot.party.hostProfileId,
                successor.profileId,
                connection,
            )) return null;
        } else if (hostStale) {
            await repo.closeParty(snapshot.party.id, connection);
        }
        await repo.deletePartyMembers(snapshot.party.id, staleProfileIds, connection);
        if (role === "host") await repo.extendPartyLifetime(snapshot.party.id, undefined, connection);
        const refreshed = await repo.findPartyById(snapshot.party.id, connection);
        if (refreshed === null) return null;
        return {
            state: roomState(refreshed, await repo.listMembers(snapshot.party.id, connection), profileId),
            staleProfileIds,
            hostStale,
            successorProfileId: successor?.profileId ?? null,
        };
    });

    if (heartbeat === null) return { ok: false, code: "unavailable" };
    if (heartbeat.successorProfileId !== null) {
        await publishComposition({
            type: "host-changed",
            roomCode: code,
            eventAtMs: heartbeat.state.serverNowMs,
            hostProfileId: heartbeat.successorProfileId,
            participants: heartbeat.state.participants,
        });
    } else if (heartbeat.hostStale) {
        await publishComposition({
            type: "party-closed",
            roomCode: code,
            eventAtMs: heartbeat.state.serverNowMs,
            closedAtMs: heartbeat.state.closedAtMs ?? heartbeat.state.serverNowMs,
            participants: heartbeat.state.participants,
        });
    } else if (heartbeat.staleProfileIds[0] !== undefined) {
        await publishComposition({
            type: "member-left",
            roomCode: code,
            eventAtMs: heartbeat.state.serverNowMs,
            profileId: heartbeat.staleProfileIds[0],
            participants: heartbeat.state.participants,
        });
    }
    return { ok: true, value: heartbeat.state };
};

export const getPartyRoomState = async (
    user: AuthUser,
    rawCode: string,
): Promise<PartyLifecycleResult<WatchPartyRoomState>> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null) return { ok: false, code: "unavailable" };
    const snapshot = await repo.findPartyByCode(code);
    if (snapshot === null) return { ok: false, code: "unavailable" };
    if (!await hasFullAccess(user, snapshot.party.seriesKey)) return { ok: false, code: "unavailable" };
    const profileId = await resolveRoomProfile(user);
    if (await repo.findMemberRole(snapshot.party.id, profileId) === null) {
        return { ok: false, code: "unavailable" };
    }
    const [participants, messages] = await Promise.all([
        repo.listMembers(snapshot.party.id),
        repo.listRecentMessages(snapshot.party.id, PARTY_MESSAGE_HISTORY_LIMIT),
    ]);
    return { ok: true, value: { ...roomState(snapshot, participants, profileId), messages } };
};
