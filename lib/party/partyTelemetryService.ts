import "server-only";
import type { AuthUser } from "@/lib/core/contracts";
import { getUserSeriesAccessLevel } from "@/lib/access/entitlements";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import * as partyRepo from "@/lib/party/partyRepository";
import * as telemetryRepo from "@/lib/party/partyTelemetryRepository";
import { isPartyAlive, normalizeRoomCode } from "@/lib/party/partyService";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const isCounter = (value: unknown): value is number =>
    Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000;

export const savePartyTelemetry = async (
    user: AuthUser,
    rawCode: string,
    input: telemetryRepo.PartyTelemetryReport,
): Promise<boolean> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null || !SESSION_ID.test(input.sessionId) || input.driftBuckets.length !== 5
        || !input.driftBuckets.every(isCounter) || !isCounter(input.hardSeeks)
        || (input.timeToSyncMs !== null && (!isCounter(input.timeToSyncMs) || input.timeToSyncMs > 3_600_000))) {
        return false;
    }
    const snapshot = await partyRepo.findPartyByCode(code);
    if (snapshot === null || !isPartyAlive(snapshot.party, snapshot.serverNowMs)) return false;
    if (await getUserSeriesAccessLevel(user, snapshot.party.seriesKey) !== "full") return false;
    const profileId = await resolveOwnedProfileId(user.id, user.username);
    if (await partyRepo.findMemberRole(snapshot.party.id, profileId) === null) return false;
    await telemetryRepo.upsertPartyTelemetry(input);
    return true;
};

export interface PartyTelemetryOverview {
    sessions: number;
    driftBuckets: [number, number, number, number, number];
    hardSeeksPerSession: number;
    averageTimeToSyncMs: number | null;
    maximumTimeToSyncMs: number | null;
    buffering: { cycles: number; recovered: number; timedOut: number };
}

export const loadPartyTelemetryOverview = async (): Promise<PartyTelemetryOverview> => {
    const row = await telemetryRepo.getPartyTelemetryOverview();
    const number = (value: string | number): number => Number(value);
    const sessions = number(row.sessions);
    const syncedSessions = number(row.synced_sessions);
    return {
        sessions,
        driftBuckets: [
            number(row.drift_dead_zone), number(row.drift_under_half), number(row.drift_under_one),
            number(row.drift_under_two), number(row.drift_over_two),
        ],
        hardSeeksPerSession: sessions === 0 ? 0 : number(row.hard_seeks) / sessions,
        averageTimeToSyncMs: syncedSessions === 0 ? null : number(row.sync_time_total_ms) / syncedSessions,
        maximumTimeToSyncMs: syncedSessions === 0 ? null : number(row.sync_time_max_ms),
        buffering: {
            cycles: number(row.buffering_cycles),
            recovered: number(row.buffering_recovered),
            timedOut: number(row.buffering_timed_out),
        },
    };
};
