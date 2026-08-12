import { describe, expect, it } from "vitest";
import type { WatchPartyRoomState } from "@/lib/core/contracts";
import { applyPartyEventToRoom } from "../partyEvents";
import { partyReconnectDelay, recoveredPartyPosition } from "../partyRecovery";

const room = (): WatchPartyRoomState => ({
    code: "KXRT49",
    hostProfileId: 10,
    currentEpisode: { seriesKey: "Steins Gate", episodeKey: "01.mp4" },
    controlMode: "host",
    anchor: { state: "playing", positionSeconds: 40, anchorAtMs: 1_000_000, anchorVersion: 8 },
    participants: [],
    serverNowMs: 1_005_000,
    expiresAtMs: 2_000_000,
    closedAtMs: null,
});

describe("odzyskiwanie pokoju", () => {
    it("po utracie połączenia wylicza pozycję z kotwicy i aktualnego offsetu", () => {
        expect(recoveredPartyPosition(room(), 250, 1_010_000)).toBe(50.25);
    });

    it("opóźnione zdarzenie z okresu rozłączenia nie cofa odtworzonego stanu", () => {
        const current = room();
        const result = applyPartyEventToRoom(current, {
            type: "seek",
            roomCode: current.code,
            eventAtMs: 1_004_000,
        episodeKey: "01.mp4",
        actorProfileId: 10,
            anchor: { state: "playing", positionSeconds: 12, anchorAtMs: 1_004_000, anchorVersion: 7 },
        });

        expect(result.applied).toBe(false);
        expect(result.room.anchor).toEqual(current.anchor);
    });

    it("backoff jest wykładniczy i kończy się jawnym wyczerpaniem prób", () => {
        expect([0, 1, 2, 3, 4, 5].map(partyReconnectDelay)).toEqual([0, 1_000, 2_000, 4_000, 8_000, 16_000]);
        expect(partyReconnectDelay(6)).toBeNull();
    });
});
