import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserSeriesAccessLevel = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ getUserSeriesAccessLevel }));
const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));
const findPartyByCode = vi.fn();
const findPartyByCodeForUpdate = vi.fn();
const findPartyById = vi.fn();
const findMemberRole = vi.fn();
const touchMember = vi.fn();
const listMembers = vi.fn();
const beginBufferingPause = vi.fn();
const finishBufferingPause = vi.fn();
const transferPartyHost = vi.fn();
const updateControlMode = vi.fn();
vi.mock("@/lib/party/partyRepository", () => ({
    findPartyByCode, findPartyByCodeForUpdate, findPartyById, findMemberRole, touchMember,
    listMembers, beginBufferingPause, finishBufferingPause, transferPartyHost, updateControlMode,
}));
vi.mock("@/lib/db/transaction", () => ({ withTransaction: (work: (db: unknown) => unknown) => work({}) }));
vi.mock("@/lib/party/realtimeChannel", () => ({ publishPartyEvent: vi.fn() }));
vi.mock("@/lib/party/partyTelemetryRepository", () => ({
    recordBufferingCycle: vi.fn(),
    recordBufferingExit: vi.fn(),
}));

const { changePartyControlMode, reportPartyBuffering, transferPartyHost: transferHost } = await import("../partyCoordinationService");
const NOW = 1_700_000_000_000;
const USER = { id: 1, username: "host", email: "h@example.com", onboardedAt: null };
const member = { profileId: 10, name: "Host", avatar: null, role: "host", joinedAtMs: NOW, lastSeenAtMs: NOW, isBuffering: true };
const snapshot = (overrides: Record<string, unknown> = {}) => ({
    serverNowMs: NOW,
    party: {
        id: 5, roomCode: "KXRT49", hostProfileId: 10, seriesKey: "Series", episodeKey: "01.mp4",
        controlMode: "host", anchor: { state: "playing", positionSeconds: 30, anchorAtMs: NOW, anchorVersion: 2 },
        bufferingWait: null, bufferingCooldownUntilMs: null, createdAtMs: NOW,
        expiresAtMs: NOW + 60_000, closedAtMs: null, ...overrides,
    },
});

beforeEach(() => {
    vi.clearAllMocks();
    getUserSeriesAccessLevel.mockResolvedValue("full");
    resolveOwnedProfileId.mockResolvedValue(10);
    findPartyByCode.mockResolvedValue(snapshot());
    findPartyByCodeForUpdate.mockResolvedValue(snapshot());
    findPartyById.mockResolvedValue(snapshot());
    findMemberRole.mockResolvedValue("host");
    touchMember.mockResolvedValue(true);
    listMembers.mockResolvedValue([member]);
    beginBufferingPause.mockResolvedValue(true);
    finishBufferingPause.mockResolvedValue(true);
    transferPartyHost.mockResolvedValue(true);
    updateControlMode.mockResolvedValue(true);
});

describe("koordynacja buforowania", () => {
    it("kończy pauzę po twardym limicie mimo dalszego buforowania", async () => {
        findPartyByCodeForUpdate.mockResolvedValue(snapshot({
            anchor: { state: "paused", positionSeconds: 30, anchorAtMs: NOW, anchorVersion: 3 },
            bufferingWait: { profileId: 10, startedAtMs: NOW - 20_000, timeoutAtMs: NOW - 1 },
        }));
        await reportPartyBuffering(USER, "KXRT49", { reconcile: true });
        expect(finishBufferingPause).toHaveBeenCalledTimes(1);
        expect(beginBufferingPause).not.toHaveBeenCalled();
    });

    it("drugie zgłoszenie w aktywnym cyklu nie rozpoczyna kolejnej pauzy", async () => {
        findPartyByCodeForUpdate.mockResolvedValue(snapshot({
            anchor: { state: "paused", positionSeconds: 30, anchorAtMs: NOW, anchorVersion: 3 },
            bufferingWait: { profileId: 10, startedAtMs: NOW, timeoutAtMs: NOW + 12_000 },
        }));
        await reportPartyBuffering(USER, "KXRT49", { buffering: true });
        await reportPartyBuffering(USER, "KXRT49", { buffering: true });
        expect(beginBufferingPause).not.toHaveBeenCalled();
        expect(finishBufferingPause).not.toHaveBeenCalled();
    });
});

it("z dwóch konkurencyjnych przekazań tylko zapis warunkowy wybiera hosta", async () => {
    transferPartyHost.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await transferHost(USER, "KXRT49", 20)).ok).toBe(true);
    expect(await transferHost(USER, "KXRT49", 30)).toEqual({ ok: false, code: "stale" });
});

it("zmiana trybu przez hosta jest zapisana i rozgłaszana jako zdarzenie", async () => {
    findPartyById.mockResolvedValue(snapshot({ controlMode: "everyone" }));

    const result = await changePartyControlMode(USER, "KXRT49", "everyone");

    expect(updateControlMode).toHaveBeenCalledWith(5, 10, "everyone", {});
    expect(result).toMatchObject({ ok: true, event: { type: "control-mode", controlMode: "everyone" } });
});
