import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { AuthUser, WatchPartyControlMode, WatchPartySnapshot } from "@/lib/core/contracts";
import { getUserSeriesAccessLevel } from "@/lib/access/entitlements";
import { withTransaction } from "@/lib/db/transaction";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import type { PartyBufferingEvent, PartyControlModeEvent, PartyHostChangedEvent } from "@/lib/party/partyEvents";
import * as repo from "@/lib/party/partyRepository";
import * as telemetryRepo from "@/lib/party/partyTelemetryRepository";
import { isPartyAlive, normalizeRoomCode } from "@/lib/party/partyService";
import { publishPartyEvent } from "@/lib/party/realtimeChannel";

export const PARTY_BUFFERING_DEBOUNCE_MS = 800;
export const PARTY_BUFFERING_TIMEOUT_SECONDS = 12;
export const PARTY_BUFFERING_COOLDOWN_SECONDS = 5;

export type PartyCoordinationFailure = "invalid" | "unavailable" | "forbidden" | "stale";
export type PartyBufferingResult =
    | { ok: true; event: PartyBufferingEvent }
    | { ok: false; code: PartyCoordinationFailure };
export type PartyHostTransferResult =
    | { ok: true; event: PartyHostChangedEvent }
    | { ok: false; code: PartyCoordinationFailure };
export type PartyControlModeResult =
    | { ok: true; event: PartyControlModeEvent }
    | { ok: false; code: PartyCoordinationFailure };

const loadLockedParty = (code: string, connection: PoolConnection): Promise<WatchPartySnapshot | null> =>
    repo.findPartyByCodeForUpdate(code, connection);

const publish = async (event: PartyBufferingEvent | PartyHostChangedEvent | PartyControlModeEvent): Promise<void> => {
    try {
        await publishPartyEvent(event.roomCode, { name: event.type, data: event });
    } catch {
        console.error("Nie udało się rozesłać zmiany koordynacji pokoju.");
    }
};

export const changePartyControlMode = async (
    user: AuthUser,
    rawCode: string,
    controlMode: WatchPartyControlMode,
): Promise<PartyControlModeResult> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null || (controlMode !== "host" && controlMode !== "everyone")) {
        return { ok: false, code: "invalid" };
    }
    const candidate = await repo.findPartyByCode(code);
    if (candidate === null || !isPartyAlive(candidate.party, candidate.serverNowMs)) {
        return { ok: false, code: "unavailable" };
    }
    if (await getUserSeriesAccessLevel(user, candidate.party.seriesKey) !== "full") {
        return { ok: false, code: "unavailable" };
    }
    const profileId = await resolveOwnedProfileId(user.id, user.username);
    const event = await withTransaction(async (connection): Promise<PartyControlModeEvent | PartyCoordinationFailure> => {
        const snapshot = await loadLockedParty(code, connection);
        if (snapshot === null || !isPartyAlive(snapshot.party, snapshot.serverNowMs)) return "unavailable";
        if (snapshot.party.hostProfileId !== profileId) return "forbidden";
        if (!await repo.updateControlMode(snapshot.party.id, profileId, controlMode, connection)) return "stale";
        const refreshed = await repo.findPartyById(snapshot.party.id, connection);
        if (refreshed === null) return "unavailable";
        return {
            type: "control-mode",
            roomCode: code,
            eventAtMs: refreshed.serverNowMs,
            actorProfileId: profileId,
            controlMode: refreshed.party.controlMode,
        };
    });
    if (typeof event === "string") return { ok: false, code: event };
    await publish(event);
    return { ok: true, event };
};

export const reportPartyBuffering = async (
    user: AuthUser,
    rawCode: string,
    input: { buffering?: boolean; reconcile?: boolean },
): Promise<PartyBufferingResult> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null || (input.reconcile !== true && typeof input.buffering !== "boolean")) {
        return { ok: false, code: "invalid" };
    }
    const candidate = await repo.findPartyByCode(code);
    if (candidate === null || !isPartyAlive(candidate.party, candidate.serverNowMs)) {
        return { ok: false, code: "unavailable" };
    }
    if (await getUserSeriesAccessLevel(user, candidate.party.seriesKey) !== "full") {
        return { ok: false, code: "unavailable" };
    }
    const profileId = await resolveOwnedProfileId(user.id, user.username);

    const event = await withTransaction(async (connection): Promise<PartyBufferingEvent | null> => {
        const snapshot = await loadLockedParty(code, connection);
        if (snapshot === null || !isPartyAlive(snapshot.party, snapshot.serverNowMs)) return null;
        if (await repo.findMemberRole(snapshot.party.id, profileId, connection) === null) return null;
        if (input.reconcile !== true) {
            if (!await repo.touchMember(snapshot.party.id, profileId, input.buffering === true, connection)) return null;
        }

        let participants = await repo.listMembers(snapshot.party.id, connection);
        const wait = snapshot.party.bufferingWait ?? null;
        const shouldFinish = wait !== null && (
            snapshot.serverNowMs >= wait.timeoutAtMs
            || !participants.some((participant) => participant.isBuffering)
        );
        if (shouldFinish) {
            if (await repo.finishBufferingPause(snapshot.party.id, PARTY_BUFFERING_COOLDOWN_SECONDS, connection)) {
                await telemetryRepo.recordBufferingExit(
                    snapshot.serverNowMs >= (wait?.timeoutAtMs ?? Number.POSITIVE_INFINITY) ? "timed-out" : "recovered",
                    connection,
                );
            }
        } else if (
            wait === null
            && input.buffering === true
            && snapshot.party.anchor.state === "playing"
            && (snapshot.party.bufferingCooldownUntilMs ?? 0) <= snapshot.serverNowMs
        ) {
            if (await repo.beginBufferingPause(
                snapshot.party.id,
                profileId,
                PARTY_BUFFERING_TIMEOUT_SECONDS,
                connection,
            )) await telemetryRepo.recordBufferingCycle(connection);
        }

        const refreshed = await repo.findPartyById(snapshot.party.id, connection);
        if (refreshed === null) return null;
        participants = await repo.listMembers(snapshot.party.id, connection);
        return {
            type: "buffering",
            roomCode: code,
            eventAtMs: refreshed.serverNowMs,
            anchor: refreshed.party.anchor,
            bufferingWait: refreshed.party.bufferingWait ?? null,
            participants,
        };
    });

    if (event === null) return { ok: false, code: "unavailable" };
    await publish(event);
    return { ok: true, event };
};

export const transferPartyHost = async (
    user: AuthUser,
    rawCode: string,
    targetProfileId: number,
): Promise<PartyHostTransferResult> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null || !Number.isSafeInteger(targetProfileId) || targetProfileId < 1) {
        return { ok: false, code: "invalid" };
    }
    const candidate = await repo.findPartyByCode(code);
    if (candidate === null || !isPartyAlive(candidate.party, candidate.serverNowMs)) {
        return { ok: false, code: "unavailable" };
    }
    if (await getUserSeriesAccessLevel(user, candidate.party.seriesKey) !== "full") {
        return { ok: false, code: "unavailable" };
    }
    const profileId = await resolveOwnedProfileId(user.id, user.username);

    const event = await withTransaction(async (connection): Promise<PartyHostChangedEvent | PartyCoordinationFailure> => {
        const snapshot = await loadLockedParty(code, connection);
        if (snapshot === null || !isPartyAlive(snapshot.party, snapshot.serverNowMs)) return "unavailable";
        if (snapshot.party.hostProfileId !== profileId) return "forbidden";
        if (targetProfileId === profileId) return "invalid";
        const transferred = await repo.transferPartyHost(
            snapshot.party.id,
            profileId,
            targetProfileId,
            connection,
        );
        if (!transferred) return "stale";
        const refreshed = await repo.findPartyById(snapshot.party.id, connection);
        if (refreshed === null) return "unavailable";
        return {
            type: "host-changed",
            roomCode: code,
            eventAtMs: refreshed.serverNowMs,
            hostProfileId: targetProfileId,
            participants: await repo.listMembers(snapshot.party.id, connection),
        };
    });

    if (typeof event === "string") return { ok: false, code: event };
    await publish(event);
    return { ok: true, event };
};
