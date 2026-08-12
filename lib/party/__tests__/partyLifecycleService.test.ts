import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

const getUserSeriesAccessLevel = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ getUserSeriesAccessLevel }));

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));

const createParty = vi.fn();
const findMemberRole = vi.fn();
const findPartyByCode = vi.fn();
const findPartyByCodeForUpdate = vi.fn();
const findPartyById = vi.fn();
const hasReadyPartyEpisode = vi.fn();
const joinParty = vi.fn();
const leaveParty = vi.fn();
const closeParty = vi.fn();
const listMembers = vi.fn();
const listRecentMessages = vi.fn();
const listStaleMembers = vi.fn();
const deletePartyMembers = vi.fn();
const touchMember = vi.fn();
const heartbeatMember = vi.fn();
const extendPartyLifetime = vi.fn();
const transferPartyHost = vi.fn();
vi.mock("@/lib/party/partyRepository", () => ({
    createParty,
    findMemberRole,
    findPartyByCode,
    findPartyByCodeForUpdate,
    findPartyById,
    hasReadyPartyEpisode,
    joinParty,
    leaveParty,
    closeParty,
    listMembers,
    listRecentMessages,
    listStaleMembers,
    deletePartyMembers,
    touchMember,
    heartbeatMember,
    extendPartyLifetime,
    transferPartyHost,
}));

const publishPartyEvent = vi.fn();
vi.mock("@/lib/party/realtimeChannel", () => ({ publishPartyEvent }));

const connection = { execute: vi.fn() };
vi.mock("@/lib/db/transaction", () => ({
    withTransaction: (work: (db: unknown) => unknown) => work(connection),
}));

const {
    createPartyRoom,
    getPartyRoomState,
    heartbeatPartyRoom,
    joinPartyRoom,
    leavePartyRoom,
} = await import("../partyLifecycleService");

const NOW = 1_700_000_000_000;
const USER = {
    id: 1,
    username: "kacper",
    email: "k@example.com",
    role: "viewer" as const,
    onboardedAt: "2026-08-01T00:00:00.000Z",
};

const partySnapshot = (overrides: Record<string, unknown> = {}) => ({
    serverNowMs: NOW,
    party: {
        id: 5,
        roomCode: "KXRT49",
        hostProfileId: 10,
        seriesKey: "Steins Gate",
        episodeKey: "01.mp4",
        controlMode: "host",
        anchor: { state: "paused", positionSeconds: 120, anchorAtMs: NOW - 5_000, anchorVersion: 3 },
        createdAtMs: NOW - 60_000,
        expiresAtMs: NOW + 3_600_000,
        closedAtMs: null,
        ...overrides,
    },
});

const host = {
    profileId: 10,
    name: "Kacper",
    avatar: null,
    role: "host",
    joinedAtMs: NOW - 60_000,
    lastSeenAtMs: NOW,
    isBuffering: false,
};

beforeEach(() => {
    vi.clearAllMocks();
    getUserSeriesAccessLevel.mockResolvedValue("full");
    resolveOwnedProfileId.mockResolvedValue(10);
    hasReadyPartyEpisode.mockResolvedValue(true);
    createParty.mockResolvedValue(5);
    findPartyByCode.mockResolvedValue(partySnapshot());
    findPartyByCodeForUpdate.mockResolvedValue(partySnapshot());
    findPartyById.mockResolvedValue(partySnapshot());
    findMemberRole.mockResolvedValue("host");
    listMembers.mockResolvedValue([host]);
    listRecentMessages.mockResolvedValue([]);
    listStaleMembers.mockResolvedValue([]);
    deletePartyMembers.mockResolvedValue(0);
    touchMember.mockResolvedValue(true);
    heartbeatMember.mockResolvedValue(true);
    publishPartyEvent.mockResolvedValue(undefined);
    transferPartyHost.mockResolvedValue(true);
});

describe("bramka uprawnień pokoju", () => {
    it("konto bez poziomu full nie utworzy pokoju", async () => {
        getUserSeriesAccessLevel.mockResolvedValue("demo");

        await expect(createPartyRoom(USER, {
            seriesKey: "Steins Gate",
            episodeKey: "01.mp4",
        })).resolves.toEqual({ ok: false, code: "forbidden" });
        expect(createParty).not.toHaveBeenCalled();
    });

    it("konto bez poziomu full nie dołączy i dostaje ten sam wynik co brak pokoju", async () => {
        getUserSeriesAccessLevel.mockResolvedValue("demo");
        const forbidden = await joinPartyRoom(USER, "KXRT49");

        findPartyByCode.mockResolvedValue(null);
        getUserSeriesAccessLevel.mockResolvedValue("full");
        const missing = await joinPartyRoom(USER, "KXRT49");

        expect(forbidden).toEqual({ ok: false, code: "unavailable" });
        expect(missing).toEqual(forbidden);
    });

    it("zamknięty pokój daje ten sam wynik co brak uprawnienia", async () => {
        findPartyByCode.mockResolvedValue(partySnapshot({ closedAtMs: NOW - 1 }));

        await expect(joinPartyRoom(USER, "KXRT49")).resolves.toEqual({ ok: false, code: "unavailable" });
    });
});

describe("utworzenie i kod zaproszenia", () => {
    it("tworzy pokój i hosta atomowo dla gotowego odcinka", async () => {
        const result = await createPartyRoom(
            USER,
            { seriesKey: "Steins Gate", episodeKey: "01.mp4" },
            () => "ABCDEFGHJKM2",
        );

        expect(result.ok).toBe(true);
        expect(createParty).toHaveBeenCalledWith(expect.objectContaining({
            roomCode: "ABCDEFGHJKM2",
            hostProfileId: 10,
        }), connection);
        expect(joinParty).toHaveBeenCalledWith(5, 10, "host", connection);
    });

    it("po kolizji kodu generuje następny i nie wysypuje żądania", async () => {
        createParty
            .mockRejectedValueOnce(new DatabaseError("conflict", 409, "duplikat"))
            .mockResolvedValueOnce(5);
        const codes = ["ABCDEFGHJKM2", "NPQRSTUVWXY2"];

        await expect(createPartyRoom(
            USER,
            { seriesKey: "Steins Gate", episodeKey: "01.mp4" },
            () => codes.shift() ?? "NPQRSTUVWXY2",
        )).resolves.toMatchObject({ ok: true });

        expect(createParty).toHaveBeenCalledTimes(2);
        expect(createParty.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ roomCode: "NPQRSTUVWXY2" }));
    });
});

describe("wyjście i obecność", () => {
    it("wyjście hosta zamyka pokój i rozsyła zamknięcie", async () => {
        findPartyById.mockResolvedValue(partySnapshot({ closedAtMs: NOW }));

        await expect(leavePartyRoom(USER, "KXRT49")).resolves.toMatchObject({ ok: true });

        expect(closeParty).toHaveBeenCalledWith(5, connection);
        expect(leaveParty).not.toHaveBeenCalled();
        expect(publishPartyEvent).toHaveBeenCalledWith("KXRT49", expect.objectContaining({ name: "party-closed" }));
    });

    it("wyjście gościa usuwa tylko jego członkostwo", async () => {
        resolveOwnedProfileId.mockResolvedValue(77);
        findMemberRole.mockResolvedValue("guest");

        await leavePartyRoom(USER, "KXRT49");

        expect(leaveParty).toHaveBeenCalledWith(5, 77, connection);
        expect(closeParty).not.toHaveBeenCalled();
        expect(publishPartyEvent).toHaveBeenCalledWith("KXRT49", expect.objectContaining({ name: "member-left" }));
    });

    it("heartbeat hosta przedłuża expires_at i nie zapisuje kotwicy", async () => {
        const before = partySnapshot();
        const after = partySnapshot({ expiresAtMs: NOW + 6 * 60 * 60 * 1000 });
        findPartyByCode.mockResolvedValue(before);
        findPartyByCodeForUpdate.mockResolvedValue(before);
        findPartyById.mockResolvedValue(after);

        const result = await heartbeatPartyRoom(USER, "KXRT49");

        expect(extendPartyLifetime).toHaveBeenCalledWith(5, undefined, connection);
        expect(result).toMatchObject({ ok: true, value: { anchor: before.party.anchor } });
    });

    it("usuwa gościa bez heartbeatu bez zmiany kotwicy", async () => {
        const staleGuest = { profileId: 77, role: "guest" as const };
        listStaleMembers.mockResolvedValue([staleGuest]);
        listMembers.mockResolvedValue([host]);

        const result = await heartbeatPartyRoom(USER, "KXRT49");

        expect(deletePartyMembers).toHaveBeenCalledWith(5, [77], connection);
        expect(result).toMatchObject({ ok: true, value: { anchor: partySnapshot().party.anchor } });
        expect(publishPartyEvent).toHaveBeenCalledWith("KXRT49", expect.objectContaining({
            name: "member-left",
            data: expect.objectContaining({ profileId: 77 }),
        }));
    });

    it("zamyka pokój, gdy host przestaje wysyłać heartbeat", async () => {
        resolveOwnedProfileId.mockResolvedValue(77);
        findMemberRole.mockResolvedValue("guest");
        listStaleMembers.mockResolvedValue([{ profileId: 10, role: "host" }]);
        findPartyById.mockResolvedValue(partySnapshot({ closedAtMs: NOW }));

        await heartbeatPartyRoom(USER, "KXRT49");

        expect(closeParty).toHaveBeenCalledWith(5, connection);
        expect(publishPartyEvent).toHaveBeenCalledWith("KXRT49", expect.objectContaining({ name: "party-closed" }));
    });

    it("GET odtwarza stan z bazy wyłącznie uczestnikowi z pełnym dostępem", async () => {
        const result = await getPartyRoomState(USER, "KXRT49");

        expect(result).toMatchObject({
            ok: true,
            value: {
                currentEpisode: { seriesKey: "Steins Gate", episodeKey: "01.mp4" },
                participants: [host],
                anchor: partySnapshot().party.anchor,
            },
        });
    });

    it("GET dołącza historię czatu z ograniczonym limitem, nie jest to drugi endpoint odpytywany cyklicznie", async () => {
        const history = [{ id: 1, profileId: 10, body: "cześć", createdAtMs: NOW - 1000 }];
        listRecentMessages.mockResolvedValue(history);

        const result = await getPartyRoomState(USER, "KXRT49");

        expect(listRecentMessages).toHaveBeenCalledWith(5, 50);
        expect(result).toMatchObject({ ok: true, value: { messages: history } });
    });

    it("awansuje deterministycznie najwcześniej dołączonego aktywnego uczestnika", async () => {
        const earlyGuest = { ...host, profileId: 20, name: "Pierwszy", role: "guest" as const, joinedAtMs: NOW - 40_000 };
        const lateGuest = { ...host, profileId: 30, name: "Drugi", role: "guest" as const, joinedAtMs: NOW - 20_000 };
        resolveOwnedProfileId.mockResolvedValue(20);
        findMemberRole.mockResolvedValue("guest");
        listStaleMembers.mockResolvedValue([{ profileId: 10, role: "host" }]);
        listMembers.mockResolvedValueOnce([host, earlyGuest, lateGuest]).mockResolvedValueOnce([earlyGuest, lateGuest]);
        findPartyById.mockResolvedValue(partySnapshot({ hostProfileId: 20 }));

        await heartbeatPartyRoom(USER, "KXRT49");

        expect(transferPartyHost).toHaveBeenCalledWith(5, 10, 20, connection);
        expect(closeParty).not.toHaveBeenCalled();
        expect(publishPartyEvent).toHaveBeenCalledWith("KXRT49", expect.objectContaining({ name: "host-changed" }));
    });

    it("konto bez uprawnienia nie pobiera historii czatu", async () => {
        getUserSeriesAccessLevel.mockResolvedValue("demo");

        await getPartyRoomState(USER, "KXRT49");

        expect(listRecentMessages).not.toHaveBeenCalled();
    });
});
