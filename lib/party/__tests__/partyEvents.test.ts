import { describe, expect, it } from "vitest";
import type { WatchPartyRoomState } from "@/lib/core/contracts";
import {
    applyPartyEventToRoom,
    initialPartyEventCursor,
    parsePartyEventMessage,
    validatePartyEvent,
    type PartyControlEvent,
} from "../partyEvents";

const NOW = 1_700_000_000_000;
const room: WatchPartyRoomState = {
    code: "KXRT49",
    hostProfileId: 10,
    currentEpisode: { seriesKey: "Steins Gate", episodeKey: "01.mp4" },
    controlMode: "host",
    anchor: { state: "playing", positionSeconds: 100, anchorAtMs: NOW, anchorVersion: 5 },
    participants: [],
    serverNowMs: NOW,
    expiresAtMs: NOW + 3_600_000,
    closedAtMs: null,
};

const controlEvent = (version: number): PartyControlEvent => ({
    type: "pause",
    roomCode: "KXRT49",
    eventAtMs: NOW + version,
    anchor: { state: "paused", positionSeconds: 110, anchorAtMs: NOW + version, anchorVersion: version },
    episodeKey: "01.mp4",
    actorProfileId: 10,
});

describe("protokół zdarzeń pokoju", () => {
    it("spóźnione i powtórzone zdarzenie sterujące nie cofa kotwicy", () => {
        const stale = applyPartyEventToRoom(room, controlEvent(4));
        const duplicate = applyPartyEventToRoom(room, controlEvent(5));
        const fresh = applyPartyEventToRoom(room, controlEvent(6));

        expect(stale.applied).toBe(false);
        expect(duplicate.applied).toBe(false);
        expect(fresh.applied).toBe(true);
        expect(fresh.room.anchor.anchorVersion).toBe(6);
        expect(applyPartyEventToRoom(fresh.room, controlEvent(5)).room.anchor.anchorVersion).toBe(6);
    });

    it("powtórzony snapshot składu jest idempotentny", () => {
        const event = {
            type: "member-joined" as const,
            roomCode: "KXRT49",
            eventAtMs: NOW + 100,
            participants: [],
        };
        const first = applyPartyEventToRoom(room, event, initialPartyEventCursor(room));
        const repeated = applyPartyEventToRoom(first.room, event, first.cursor);

        expect(first.applied).toBe(true);
        expect(repeated.applied).toBe(false);
    });

    it("waliduje pełną kotwicę i odrzuca event bez wersji", () => {
        expect(validatePartyEvent(controlEvent(6))).not.toBeNull();
        expect(validatePartyEvent({ ...controlEvent(6), anchor: { state: "paused" } })).toBeNull();
    });

    it("rozpakowuje kopertę wiadomości kanału", () => {
        const event = controlEvent(6);
        const raw = JSON.stringify({ name: "pause", data: event });

        expect(parsePartyEventMessage(raw)).toEqual(event);
    });

    it("zmiana trybu obowiązuje natychmiast i zapisuje autora", () => {
        const result = applyPartyEventToRoom(room, {
            type: "control-mode",
            roomCode: "KXRT49",
            eventAtMs: NOW + 1,
            actorProfileId: 10,
            controlMode: "everyone",
        });

        expect(result.room.controlMode).toBe("everyone");
        expect(result.room.lastAction).toEqual({ profileId: 10, kind: "control-mode", atMs: NOW + 1 });
    });
});
