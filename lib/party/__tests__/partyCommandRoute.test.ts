import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionRoute = vi.fn();
vi.mock("@/lib/http/routeAuth", () => ({ requireSessionRoute }));

const consumeWriteRateLimit = vi.fn();
vi.mock("@/lib/http/writeRateLimit", () => ({ consumeWriteRateLimit }));

const applyPartyCommand = vi.fn();
vi.mock("@/lib/party/partyCommandService", () => ({ applyPartyCommand }));

const { POST } = await import("@/app/api/party/[code]/command/route");
const { GET: serverTimeGET } = await import("@/app/api/party/time/route");

const USER = {
    id: 1,
    username: "kacper",
    email: "k@example.com",
    role: "viewer" as const,
    onboardedAt: "2026-08-01T00:00:00.000Z",
};
const event = {
    type: "pause",
    roomCode: "KXRT49",
    eventAtMs: 1_700_000_000_000,
    anchor: { state: "paused", positionSeconds: 100, anchorAtMs: 1_700_000_000_000, anchorVersion: 4 },
    episodeKey: "01.mp4",
    actorProfileId: 10,
};
const room = {
    code: "KXRT49",
    hostProfileId: 10,
    currentEpisode: { seriesKey: "Series", episodeKey: "01.mp4" },
    controlMode: "everyone",
    anchor: event.anchor,
    bufferingWait: null,
    participants: [],
    serverNowMs: event.eventAtMs,
    expiresAtMs: event.eventAtMs + 60_000,
    closedAtMs: null,
};

const call = (body: unknown = { command: { kind: "pause" }, expectedVersion: 3 }) => POST(
    new Request("http://localhost/api/party/KXRT49/command", {
        method: "POST",
        body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ code: "KXRT49" }) },
);

beforeEach(() => {
    vi.clearAllMocks();
    requireSessionRoute.mockResolvedValue({ ok: true, user: USER });
    consumeWriteRateLimit.mockResolvedValue(false);
    applyPartyCommand.mockResolvedValue({ ok: true, event });
});

describe("POST /api/party/[code]/command", () => {
    it("czeka na zatwierdzone zdarzenie serwera", async () => {
        const response = await call();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ event });
        expect(applyPartyCommand).toHaveBeenCalledWith(USER, "KXRT49", { kind: "pause" }, 3);
    });

    it("odrzuca komendę gościa", async () => {
        applyPartyCommand.mockResolvedValue({ ok: false, code: "forbidden" });

        expect((await call()).status).toBe(403);
    });

    it("konflikt wersji zwraca aktualny stan bez błędu HTTP", async () => {
        applyPartyCommand.mockResolvedValue({ ok: false, code: "stale", room });

        const response = await call();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ room, conflict: true });
    });

    it("używa własnej kategorii limitu", async () => {
        consumeWriteRateLimit.mockResolvedValue(true);

        expect((await call()).status).toBe(429);
        expect(consumeWriteRateLimit).toHaveBeenCalledWith(USER.id, "party-command", 120, 900);
        expect(applyPartyCommand).not.toHaveBeenCalled();
    });
});

describe("GET /api/party/time", () => {
    it("zwraca czas procesu bez odpytywania bazy i bez cache", async () => {
        const before = Date.now();
        const response = serverTimeGET();
        const body = await response.json() as { serverNowMs: number };

        expect(body.serverNowMs).toBeGreaterThanOrEqual(before);
        expect(body.serverNowMs).toBeLessThanOrEqual(Date.now());
        expect(response.headers.get("Cache-Control")).toBe("no-store");

        const source = readFileSync(resolve(__dirname, "../../../app/api/party/time/route.ts"), "utf8");
        expect(source).not.toMatch(/@\/lib\/db|findParty|Repository/u);
    });
});
