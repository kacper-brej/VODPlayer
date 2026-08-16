import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const getUserSeriesAccessLevel = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ getUserSeriesAccessLevel }));
const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));
const findPartyByCode = vi.fn();
const findMemberRole = vi.fn();
vi.mock("@/lib/party/partyRepository", () => ({ findPartyByCode, findMemberRole }));
const upsertPartyTelemetry = vi.fn();
const getPartyTelemetryOverview = vi.fn();
vi.mock("@/lib/party/partyTelemetryRepository", () => ({ upsertPartyTelemetry, getPartyTelemetryOverview }));

const { loadPartyTelemetryOverview, savePartyTelemetry } = await import("../partyTelemetryService");
const NOW = 1_700_000_000_000;
const USER = { id: 1, username: "viewer", email: "v@example.com", onboardedAt: null };
const REPORT = {
    sessionId: "123e4567-e89b-42d3-a456-426614174000",
    driftBuckets: [10, 2, 1, 1, 3] as [number, number, number, number, number],
    hardSeeks: 3,
    timeToSyncMs: 1800,
};

beforeEach(() => {
    vi.clearAllMocks();
    getUserSeriesAccessLevel.mockResolvedValue("full");
    resolveOwnedProfileId.mockResolvedValue(10);
    findMemberRole.mockResolvedValue("guest");
    findPartyByCode.mockResolvedValue({
        serverNowMs: NOW,
        party: {
            id: 5, roomCode: "KXRT49", seriesKey: "Series", expiresAtMs: NOW + 60_000, closedAtMs: null,
        },
    });
});

describe("telemetria synchronizacji", () => {
    it("przyjmuje skumulowany raport uczestnika bez danych osobowych", async () => {
        await expect(savePartyTelemetry(USER, "KXRT49", REPORT)).resolves.toBe(true);
        expect(upsertPartyTelemetry).toHaveBeenCalledWith(REPORT);
        expect(upsertPartyTelemetry.mock.calls[0]?.[0]).not.toHaveProperty("profileId");
    });

    it("odrzuca raport spoza pokoju", async () => {
        findMemberRole.mockResolvedValue(null);
        await expect(savePartyTelemetry(USER, "KXRT49", REPORT)).resolves.toBe(false);
        expect(upsertPartyTelemetry).not.toHaveBeenCalled();
    });

    it("oblicza metryki panelu z rozkładu, nie ze średniej dryfu", async () => {
        getPartyTelemetryOverview.mockResolvedValue({
            sessions: 2, drift_samples: 17, drift_dead_zone: 10, drift_under_half: 2,
            drift_under_one: 1, drift_under_two: 1, drift_over_two: 3, hard_seeks: 3,
            synced_sessions: 2, sync_time_total_ms: 3000, sync_time_max_ms: 2000,
            buffering_cycles: 4, buffering_recovered: 3, buffering_timed_out: 1,
        });
        await expect(loadPartyTelemetryOverview()).resolves.toMatchObject({
            sessions: 2,
            syncedSessions: 2,
            driftSamples: 17,
            driftBuckets: [10, 2, 1, 1, 3],
            hardSeeks: 3,
            hardSeeksPerSession: 1.5,
            averageTimeToSyncMs: 1500,
            buffering: { cycles: 4, recovered: 3, timedOut: 1 },
        });
    });

    it("klient wysyła telemetrię zbiorczo co minutę", () => {
        const source = readFileSync(resolve(__dirname, "../usePartySync.ts"), "utf8");
        expect(source).toContain("TELEMETRY_FLUSH_INTERVAL_MS = 60_000");
        expect(source).toContain("driftBuckets");
        expect(source).not.toContain("username:");
    });
});
