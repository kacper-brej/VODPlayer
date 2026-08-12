import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { AuthUser, WatchPartyCommand, WatchPartyRoomState, WatchPartySnapshot } from "@/lib/core/contracts";
import { getUserSeriesAccessLevel } from "@/lib/access/entitlements";
import { withTransaction } from "@/lib/db/transaction";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import type { PartyControlEvent } from "@/lib/party/partyEvents";
import * as repo from "@/lib/party/partyRepository";
import { canApplyCommand, nextAnchor, normalizeRoomCode } from "@/lib/party/partyService";
import { publishPartyEvent } from "@/lib/party/realtimeChannel";

export type PartyCommandFailure = "invalid" | "unavailable" | "forbidden" | "stale";
export type PartyCommandResult =
    | { ok: true; event: PartyControlEvent }
    | { ok: false; code: Exclude<PartyCommandFailure, "stale"> }
    | { ok: false; code: "stale"; room: WatchPartyRoomState };

const loadLockedParty = (
    code: string,
    connection: PoolConnection,
): Promise<WatchPartySnapshot | null> => repo.findPartyByCodeForUpdate(code, connection);

const currentRoom = async (
    snapshot: WatchPartySnapshot,
    viewerProfileId: number,
    connection: PoolConnection,
): Promise<WatchPartyRoomState> => ({
    code: snapshot.party.roomCode,
    hostProfileId: snapshot.party.hostProfileId,
    viewerRole: snapshot.party.hostProfileId === viewerProfileId ? "host" : "guest",
    viewerProfileId,
    currentEpisode: { seriesKey: snapshot.party.seriesKey, episodeKey: snapshot.party.episodeKey },
    controlMode: snapshot.party.controlMode,
    anchor: snapshot.party.anchor,
    bufferingWait: snapshot.party.bufferingWait ?? null,
    participants: await repo.listMembers(snapshot.party.id, connection),
    serverNowMs: snapshot.serverNowMs,
    expiresAtMs: snapshot.party.expiresAtMs,
    closedAtMs: snapshot.party.closedAtMs,
});

export const applyPartyCommand = async (
    user: AuthUser,
    rawCode: string,
    command: WatchPartyCommand,
    expectedVersion: number,
): Promise<PartyCommandResult> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
        return { ok: false, code: "invalid" };
    }

    const candidate = await repo.findPartyByCode(code);
    if (candidate === null) return { ok: false, code: "unavailable" };
    if (await getUserSeriesAccessLevel(user, candidate.party.seriesKey) !== "full") {
        return { ok: false, code: "unavailable" };
    }
    const profileId = await resolveOwnedProfileId(user.id, user.username);

    const result = await withTransaction(async (connection): Promise<PartyCommandResult> => {
        const snapshot = await loadLockedParty(code, connection);
        if (snapshot === null) return { ok: false, code: "unavailable" };
        if (await repo.findMemberRole(snapshot.party.id, profileId, connection) === null) {
            return { ok: false, code: "unavailable" };
        }

        const verdict = canApplyCommand(snapshot.party, profileId, command, snapshot.serverNowMs);
        if (!verdict.ok) {
            return { ok: false, code: verdict.reason === "not-controller" ? "forbidden" : "unavailable" };
        }
        if (snapshot.party.anchor.anchorVersion !== expectedVersion) {
            return { ok: false, code: "stale", room: await currentRoom(snapshot, profileId, connection) };
        }

        const episodeKey = command.kind === "episode-change" ? command.episodeKey : snapshot.party.episodeKey;
        const episode = await repo.findReadyPartyEpisode(snapshot.party.seriesKey, episodeKey, connection);
        if (episode === null) return { ok: false, code: "invalid" };

        const anchor = nextAnchor(
            snapshot.party,
            command,
            snapshot.serverNowMs,
            episode.durationSeconds ?? 604_800,
        );
        const updated = await repo.updatePlaybackAnchor({
            partyId: snapshot.party.id,
            expectedVersion,
            anchor,
            episodeKey: command.kind === "episode-change" ? command.episodeKey : undefined,
        }, connection);
        if (!updated) {
            const current = await repo.findPartyById(snapshot.party.id, connection);
            if (current === null) return { ok: false, code: "unavailable" };
            return { ok: false, code: "stale", room: await currentRoom(current, profileId, connection) };
        }

        const refreshed = await repo.findPartyById(snapshot.party.id, connection);
        if (refreshed === null) return { ok: false, code: "unavailable" };
        return {
            ok: true,
            event: {
                type: command.kind,
                roomCode: code,
                eventAtMs: refreshed.serverNowMs,
                anchor: refreshed.party.anchor,
                episodeKey: refreshed.party.episodeKey,
                actorProfileId: profileId,
            },
        };
    });

    if (result.ok) {
        try {
            await publishPartyEvent(code, { name: result.event.type, data: result.event });
        } catch {
            console.error("Nie udało się rozesłać zatwierdzonej komendy pokoju.");
        }
    }
    return result;
};
