import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { WatchParty } from "@/lib/core/contracts";
import {
    canApplyCommand,
    isAnchorNewer,
    isMemberStale,
    isPartyAlive,
    nextAnchor,
    resolvePosition,
} from "../partyService";

const NOW = 1_700_000_000_000;

const party = (overrides: Partial<WatchParty> = {}): WatchParty => ({
    id: 1,
    roomCode: "KXRT49",
    hostProfileId: 10,
    seriesKey: "Steins Gate",
    episodeKey: "01.mp4",
    controlMode: "host",
    anchor: { state: "paused", positionSeconds: 100, anchorAtMs: NOW, anchorVersion: 3 },
    createdAtMs: NOW - 60_000,
    expiresAtMs: NOW + 3_600_000,
    closedAtMs: null,
    ...overrides,
});

const playing = (positionSeconds = 100, anchorAtMs = NOW) =>
    party({ anchor: { state: "playing", positionSeconds, anchorAtMs, anchorVersion: 3 } });

describe("pozycja wyliczana z kotwicy", () => {
    it("w pauzie nie zmienia się wraz z upływem czasu", () => {
        const paused = party().anchor;

        expect(resolvePosition(paused, NOW)).toBe(100);
        expect(resolvePosition(paused, NOW + 60_000)).toBe(100);
        expect(resolvePosition(paused, NOW + 3_600_000)).toBe(100);
    });

    it("przy odtwarzaniu rośnie zgodnie z różnicą znaczników", () => {
        const anchor = playing().anchor;

        expect(resolvePosition(anchor, NOW)).toBe(100);
        expect(resolvePosition(anchor, NOW + 30_000)).toBe(130);
        expect(resolvePosition(anchor, NOW + 1_500)).toBe(101.5);
    });

    it("nie schodzi poniżej zera, gdy zegar odbiorcy jest cofnięty względem kotwicy", () => {
        const anchor = playing().anchor;

        expect(resolvePosition(anchor, NOW - 30_000)).toBe(100);
    });

    it("nie przekracza czasu trwania, gdy jest znany", () => {
        const anchor = playing().anchor;

        expect(resolvePosition(anchor, NOW + 100_000, 150)).toBe(150);
        expect(resolvePosition(anchor, NOW + 10_000, 150)).toBe(110);
    });

    it("ujemna pozycja w kotwicy jest przycinana do zera", () => {
        const anchor = playing(-5).anchor;

        expect(resolvePosition(anchor, NOW)).toBe(0);
    });
});

describe("prawo do wydania komendy", () => {
    it("gość nie steruje pokojem w trybie host", () => {
        expect(canApplyCommand(party(), 77, { kind: "pause" }, NOW)).toEqual({
            ok: false,
            reason: "not-controller",
        });
    });

    it("host steruje pokojem w trybie host", () => {
        expect(canApplyCommand(party(), 10, { kind: "pause" }, NOW)).toEqual({ ok: true });
    });

    it("w trybie everyone steruje każdy uczestnik", () => {
        expect(canApplyCommand(party({ controlMode: "everyone" }), 77, { kind: "play" }, NOW)).toEqual({
            ok: true,
        });
    });

    it("zamknięty pokój odrzuca komendę także od hosta", () => {
        expect(canApplyCommand(party({ closedAtMs: NOW - 1 }), 10, { kind: "play" }, NOW)).toEqual({
            ok: false,
            reason: "closed",
        });
    });

    it("wygasły pokój odrzuca komendę", () => {
        expect(canApplyCommand(party({ expiresAtMs: NOW - 1 }), 10, { kind: "play" }, NOW)).toEqual({
            ok: false,
            reason: "closed",
        });
    });
});

describe("nowa kotwica po komendzie", () => {
    it("pauza zamraża pozycję wyliczoną na moment komendy", () => {
        const anchor = nextAnchor(playing(), { kind: "pause" }, NOW + 20_000);

        expect(anchor.state).toBe("paused");
        expect(anchor.positionSeconds).toBe(120);
        expect(anchor.anchorAtMs).toBe(NOW + 20_000);
    });

    it("wznowienie przesuwa kotwicę na teraz bez zmiany pozycji", () => {
        const anchor = nextAnchor(party(), { kind: "play" }, NOW + 20_000);

        expect(anchor.state).toBe("playing");
        expect(anchor.positionSeconds).toBe(100);
        expect(anchor.anchorAtMs).toBe(NOW + 20_000);
    });

    it("przewinięcie w pauzie nie wznawia odtwarzania", () => {
        const anchor = nextAnchor(party(), { kind: "seek", positionSeconds: 42 }, NOW + 5_000);

        expect(anchor.state).toBe("paused");
        expect(anchor.positionSeconds).toBe(42);
    });

    it("przewinięcie w trakcie odtwarzania zostawia stan grania", () => {
        const anchor = nextAnchor(playing(), { kind: "seek", positionSeconds: 42 }, NOW + 5_000);

        expect(anchor.state).toBe("playing");
        expect(anchor.positionSeconds).toBe(42);
    });

    it("zmiana odcinka zeruje pozycję i zatrzymuje pokój", () => {
        const anchor = nextAnchor(playing(), { kind: "episode-change", episodeKey: "02.mp4" }, NOW + 5_000);

        expect(anchor.state).toBe("paused");
        expect(anchor.positionSeconds).toBe(0);
    });

    it("każda komenda podnosi wersję kotwicy dokładnie o jeden", () => {
        expect(nextAnchor(party(), { kind: "play" }, NOW).anchorVersion).toBe(4);
        expect(nextAnchor(party(), { kind: "pause" }, NOW).anchorVersion).toBe(4);
        expect(nextAnchor(party(), { kind: "seek", positionSeconds: 1 }, NOW).anchorVersion).toBe(4);
    });
});

describe("porządek zdarzeń i obecność", () => {
    it("kotwica o niższej wersji nie jest nowsza", () => {
        const known = party().anchor;
        const stale = { ...known, anchorVersion: 2 };

        expect(isAnchorNewer(stale, known)).toBe(false);
        expect(isAnchorNewer({ ...known, anchorVersion: 4 }, known)).toBe(true);
        expect(isAnchorNewer(known, known)).toBe(false);
    });

    it("uczestnik bez sygnału dłużej niż limit jest uznany za nieobecnego", () => {
        expect(isMemberStale(NOW, NOW + 10_000)).toBe(false);
        expect(isMemberStale(NOW, NOW + 60_000)).toBe(true);
    });

    it("pokój żyje, dopóki nie został zamknięty i nie wygasł", () => {
        expect(isPartyAlive(party(), NOW)).toBe(true);
        expect(isPartyAlive(party({ closedAtMs: NOW }), NOW)).toBe(false);
        expect(isPartyAlive(party({ expiresAtMs: NOW }), NOW)).toBe(false);
    });
});

describe("granica warstwy reguł", () => {
    it("nie sięga do bazy, sesji ani do środowiska serwera", () => {
        const source = readFileSync(resolve(__dirname, "../partyService.ts"), "utf8");

        expect(source).not.toMatch(/from\s+["']@\/lib\/db/);
        expect(source).not.toMatch(/from\s+["']@\/lib\/auth/);
        expect(source).not.toContain("server-only");
    });
});
