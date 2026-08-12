import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserSeriesAccessLevel = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ getUserSeriesAccessLevel }));

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));

const findMemberRole = vi.fn();
const findPartyByCode = vi.fn();
const findPartyByCodeForUpdate = vi.fn();
const findPartyById = vi.fn();
const findReadyPartyEpisode = vi.fn();
const updatePlaybackAnchor = vi.fn();
const listMembers = vi.fn();
vi.mock("@/lib/party/partyRepository", () => ({
    findMemberRole,
    findPartyByCode,
    findPartyByCodeForUpdate,
    findPartyById,
    findReadyPartyEpisode,
    updatePlaybackAnchor,
    listMembers,
}));

const publishPartyEvent = vi.fn();
vi.mock("@/lib/party/realtimeChannel", () => ({ publishPartyEvent }));

const connection = { execute: vi.fn() };
vi.mock("@/lib/db/transaction", () => ({
    withTransaction: (work: (db: unknown) => unknown) => work(connection),
}));

const { applyPartyCommand } = await import("../partyCommandService");

const NOW = 1_700_000_000_000;
const USER = {
    id: 1,
    username: "kacper",
    email: "k@example.com",
    role: "viewer" as const,
    onboardedAt: "2026-08-01T00:00:00.000Z",
};
const snapshot = (version = 3) => ({
    serverNowMs: NOW,
    party: {
        id: 5,
        roomCode: "KXRT49",
        hostProfileId: 10,
        seriesKey: "Steins Gate",
        episodeKey: "01.mp4",
        controlMode: "host",
        anchor: { state: "playing", positionSeconds: 100, anchorAtMs: NOW - 10_000, anchorVersion: version },
        createdAtMs: NOW - 60_000,
        expiresAtMs: NOW + 3_600_000,
        closedAtMs: null,
    },
});

beforeEach(() => {
    vi.clearAllMocks();
    getUserSeriesAccessLevel.mockResolvedValue("full");
    resolveOwnedProfileId.mockResolvedValue(10);
    findPartyByCode.mockResolvedValue(snapshot());
    findPartyByCodeForUpdate.mockResolvedValue(snapshot());
    findPartyById.mockResolvedValue(snapshot(4));
    findMemberRole.mockResolvedValue("host");
    findReadyPartyEpisode.mockResolvedValue({ durationSeconds: 1440 });
    updatePlaybackAnchor.mockResolvedValue(true);
    listMembers.mockResolvedValue([]);
    publishPartyEvent.mockResolvedValue(undefined);
});

describe("zatwierdzanie komend pokoju", () => {
    it("komenda gościa w trybie host nie zmienia kotwicy", async () => {
        resolveOwnedProfileId.mockResolvedValue(77);
        findMemberRole.mockResolvedValue("guest");

        const result = await applyPartyCommand(USER, "KXRT49", { kind: "pause" }, 3);

        expect(result).toEqual({ ok: false, code: "forbidden" });
        expect(updatePlaybackAnchor).not.toHaveBeenCalled();
        expect(publishPartyEvent).not.toHaveBeenCalled();
    });

    it("host zapisuje nową kotwicę, a potem publikuje pełne zdarzenie", async () => {
        const result = await applyPartyCommand(USER, "KXRT49", { kind: "pause" }, 3);

        expect(updatePlaybackAnchor).toHaveBeenCalledWith(expect.objectContaining({
            partyId: 5,
            expectedVersion: 3,
            anchor: expect.objectContaining({ state: "paused", anchorVersion: 4 }),
        }), connection);
        expect(result).toMatchObject({
            ok: true,
            event: { type: "pause", anchor: { anchorVersion: 4 }, episodeKey: "01.mp4" },
        });
        expect(publishPartyEvent).toHaveBeenCalledWith("KXRT49", expect.objectContaining({
            name: "pause",
            data: expect.objectContaining({ anchor: expect.objectContaining({ anchorVersion: 4 }) }),
        }));
    });

    it("wersja starsza od stanu pod blokadą daje konflikt bez zapisu", async () => {
        const result = await applyPartyCommand(USER, "KXRT49", { kind: "seek", positionSeconds: 50 }, 2);

        expect(result).toMatchObject({ ok: false, code: "stale", room: { anchor: { anchorVersion: 3 } } });
        expect(updatePlaybackAnchor).not.toHaveBeenCalled();
    });

    it("dwie równoczesne pauzy kończą na jednym stanie, a przegrany dostaje aktualny snapshot", async () => {
        findPartyByCodeForUpdate.mockResolvedValueOnce(snapshot(3)).mockResolvedValueOnce(snapshot(4));
        findPartyById.mockResolvedValue(snapshot(4));

        const first = await applyPartyCommand(USER, "KXRT49", { kind: "pause" }, 3);
        const second = await applyPartyCommand(USER, "KXRT49", { kind: "pause" }, 3);

        expect(first).toMatchObject({ ok: true, event: { anchor: { anchorVersion: 4 } } });
        expect(second).toMatchObject({ ok: false, code: "stale", room: { anchor: { anchorVersion: 4 } } });
        expect(updatePlaybackAnchor).toHaveBeenCalledTimes(1);
    });

    it("zmiana odcinka wymaga gotowego assetu w tym samym serialu", async () => {
        findReadyPartyEpisode.mockResolvedValue(null);

        const result = await applyPartyCommand(
            USER,
            "KXRT49",
            { kind: "episode-change", episodeKey: "99.mp4" },
            3,
        );

        expect(result).toEqual({ ok: false, code: "invalid" });
        expect(updatePlaybackAnchor).not.toHaveBeenCalled();
    });

    it("zmiana odcinka zeruje kotwicę i publikuje decyzję serwera", async () => {
        await applyPartyCommand(USER, "KXRT49", { kind: "episode-change", episodeKey: "02.mp4" }, 3);

        expect(updatePlaybackAnchor).toHaveBeenCalledWith(expect.objectContaining({
            episodeKey: "02.mp4",
            anchor: expect.objectContaining({ positionSeconds: 0 }),
        }), connection);
        expect(publishPartyEvent).toHaveBeenCalledWith("KXRT49", expect.objectContaining({ name: "episode-change" }));
    });
});
