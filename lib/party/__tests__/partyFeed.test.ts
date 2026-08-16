import { describe, expect, it } from "vitest";
import type { WatchPartyMember, WatchPartyMessage } from "@/lib/core/contracts";
import { buildPartyFeed, groupPartyFeed, noticeForEvent } from "../partyFeed";

const member = (profileId: number, name: string, role: "host" | "guest" = "guest"): WatchPartyMember => ({
    profileId,
    name,
    avatar: null,
    role,
    joinedAtMs: 1000,
    lastSeenAtMs: 1000,
    isBuffering: false,
});

const message = (id: number, createdAtMs: number): WatchPartyMessage => ({
    id,
    profileId: 1,
    body: `wiadomość ${id}`,
    createdAtMs,
});

describe("partyFeed", () => {
    it("przeplata wiadomości i wpisy systemowe według czasu", () => {
        const feed = buildPartyFeed(
            [message(1, 100), message(2, 300)],
            [{ id: "n-left-200", atMs: 200, text: "Ola wyszedł(a) z pokoju" }],
        );
        expect(feed.map((entry) => entry.kind)).toEqual(["message", "notice", "message"]);
        expect(feed[1]).toMatchObject({ kind: "notice", text: "Ola wyszedł(a) z pokoju" });
    });

    it("zgłasza tylko nowe osoby przy dołączeniu do pokoju", () => {
        const known = { 1: "Kacper" };
        const notice = noticeForEvent({
            type: "member-joined",
            roomCode: "PZYY24",
            eventAtMs: 500,
            participants: [member(1, "Kacper", "host"), member(2, "Ola")],
        }, known);
        expect(notice?.text).toBe("Ola jest już z wami");

        expect(noticeForEvent({
            type: "member-joined",
            roomCode: "PZYY24",
            eventAtMs: 600,
            participants: [member(1, "Kacper", "host")],
        }, known)).toBeNull();
    });

    it("nazywa osobę, która wyszła, na podstawie wcześniej widzianego składu", () => {
        const notice = noticeForEvent({
            type: "member-left",
            roomCode: "PZYY24",
            eventAtMs: 700,
            profileId: 2,
            participants: [member(1, "Kacper", "host")],
        }, { 1: "Kacper", 2: "Ola" });
        expect(notice?.text).toBe("Ola wyszedł(a) z pokoju");
    });

    it("nie wymyśla nazwy dla nieznanego profilu", () => {
        const notice = noticeForEvent({
            type: "host-changed",
            roomCode: "PZYY24",
            eventAtMs: 800,
            hostProfileId: 9,
            participants: [],
        }, {});
        expect(notice?.text).toBe("Pokój prowadzi teraz Ktoś");
    });

    it("zdarzenia bez znaczenia dla czatu nie tworzą wpisu", () => {
        expect(noticeForEvent({
            type: "heartbeat",
            roomCode: "PZYY24",
            eventAtMs: 900,
            profileId: 1,
            lastSeenAtMs: 900,
        }, {})).toBeNull();
    });
});

describe("grupowanie wypowiedzi", () => {
    const from = (id: number, profileId: number, createdAtMs: number): WatchPartyMessage => ({
        id,
        profileId,
        body: `treść ${id}`,
        createdAtMs,
        authorName: profileId === 1 ? "Kacper" : "Ola",
    });

    it("łączy kolejne wypowiedzi tej samej osoby w jeden blok", () => {
        const groups = groupPartyFeed(buildPartyFeed([
            from(1, 2, 1000),
            from(2, 2, 2000),
            from(3, 1, 3000),
        ], []), 1);

        expect(groups).toHaveLength(2);
        expect(groups[0]).toMatchObject({ kind: "burst", name: "Ola", own: false });
        expect(groups[0]!.kind === "burst" && groups[0]!.messages).toHaveLength(2);
        expect(groups[1]).toMatchObject({ kind: "burst", own: true });
    });

    it("przerwa dłuższa niż okno rozdziela bloki", () => {
        const groups = groupPartyFeed(buildPartyFeed([
            from(1, 2, 0),
            from(2, 2, 10 * 60 * 1000),
        ], []), 1);
        expect(groups).toHaveLength(2);
    });

    it("wpis systemowy przerywa blok tej samej osoby", () => {
        const groups = groupPartyFeed(buildPartyFeed(
            [from(1, 2, 1000), from(2, 2, 3000)],
            [{ id: "n-left-2000", atMs: 2000, text: "Michał wyszedł(a) z pokoju" }],
        ), 1);

        expect(groups.map((group) => group.kind)).toEqual(["burst", "notice", "burst"]);
        expect(groups[1]).toMatchObject({ parting: true });
    });

    it("przewinięcie i zmiana odcinka trafiają do rozmowy", () => {
        const anchor = { state: "playing" as const, positionSeconds: 723.4, anchorAtMs: 5, anchorVersion: 7 };
        expect(noticeForEvent({
            type: "seek",
            roomCode: "PZYY24",
            eventAtMs: 100,
            anchor,
            episodeKey: "e1",
            actorProfileId: 1,
        }, { 1: "Kacper" })?.text).toBe("Kacper przewinął(-ęła) do 12:03");

        expect(noticeForEvent({
            type: "episode-change",
            roomCode: "PZYY24",
            eventAtMs: 120,
            anchor: { ...anchor, positionSeconds: 0, anchorVersion: 8 },
            episodeKey: "e2",
            actorProfileId: 1,
        }, { 1: "Kacper" })?.text).toBe("Kacper włączył(a) inny odcinek");
    });

    it("play i pauza nie zaśmiecają rozmowy", () => {
        const anchor = { state: "paused" as const, positionSeconds: 10, anchorAtMs: 5, anchorVersion: 9 };
        expect(noticeForEvent({
            type: "pause",
            roomCode: "PZYY24",
            eventAtMs: 130,
            anchor,
            episodeKey: "e1",
            actorProfileId: 1,
        }, { 1: "Kacper" })).toBeNull();
    });
});
