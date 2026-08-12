import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionRoute = vi.fn();
vi.mock("@/lib/http/routeAuth", () => ({ requireSessionRoute }));

const consumeWriteRateLimit = vi.fn();
vi.mock("@/lib/http/writeRateLimit", () => ({ consumeWriteRateLimit }));

const createPartyRoom = vi.fn();
const getPartyRoomState = vi.fn();
const heartbeatPartyRoom = vi.fn();
const joinPartyRoom = vi.fn();
const leavePartyRoom = vi.fn();
vi.mock("@/lib/party/partyLifecycleService", () => ({
    createPartyRoom,
    getPartyRoomState,
    heartbeatPartyRoom,
    joinPartyRoom,
    leavePartyRoom,
}));

const { POST: createPOST } = await import("@/app/api/party/route");
const { GET: stateGET } = await import("@/app/api/party/[code]/route");
const { POST: joinPOST } = await import("@/app/api/party/[code]/join/route");
const { POST: leavePOST } = await import("@/app/api/party/[code]/leave/route");
const { POST: heartbeatPOST } = await import("@/app/api/party/[code]/heartbeat/route");

const NOW = 1_700_000_000_000;
const USER = {
    id: 1,
    username: "kacper",
    email: "k@example.com",
    role: "viewer" as const,
    onboardedAt: "2026-08-01T00:00:00.000Z",
};
const room = {
    code: "KXRT49",
    hostProfileId: 10,
    currentEpisode: { seriesKey: "Steins Gate", episodeKey: "01.mp4" },
    controlMode: "host",
    anchor: { state: "paused", positionSeconds: 0, anchorAtMs: NOW, anchorVersion: 0 },
    participants: [],
    serverNowMs: NOW,
    expiresAtMs: NOW + 3_600_000,
    closedAtMs: null,
};

const post = (url: string, body: Record<string, unknown> = {}) =>
    new Request(url, { method: "POST", body: JSON.stringify(body) });
const context = (code = "KXRT49") => ({ params: Promise.resolve({ code }) });

beforeEach(() => {
    vi.clearAllMocks();
    requireSessionRoute.mockResolvedValue({ ok: true, user: USER });
    consumeWriteRateLimit.mockResolvedValue(false);
    createPartyRoom.mockResolvedValue({ ok: true, value: room });
    getPartyRoomState.mockResolvedValue({ ok: true, value: room });
    heartbeatPartyRoom.mockResolvedValue({ ok: true, value: room });
    joinPartyRoom.mockResolvedValue({ ok: true, value: room });
    leavePartyRoom.mockResolvedValue({ ok: true, value: room });
});

describe("Route Handlery W3", () => {
    it("utworzenie wymaga sesji", async () => {
        requireSessionRoute.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });

        const response = await createPOST(post("http://localhost/api/party", {
            series_key: "Steins Gate",
            episode_key: "01.mp4",
        }));

        expect(response.status).toBe(401);
        expect(createPartyRoom).not.toHaveBeenCalled();
    });

    it("brak pełnego dostępu blokuje utworzenie statusem 403", async () => {
        createPartyRoom.mockResolvedValue({ ok: false, code: "forbidden" });

        const response = await createPOST(post("http://localhost/api/party", {
            series_key: "Steins Gate",
            episode_key: "01.mp4",
        }));

        expect(response.status).toBe(403);
    });

    it("nieistniejący, zamknięty i niedostępny pokój mają tę samą odpowiedź join", async () => {
        joinPartyRoom.mockResolvedValue({ ok: false, code: "unavailable" });

        const first = await joinPOST(post("http://localhost/api/party/KXRT49/join"), context());
        const second = await joinPOST(post("http://localhost/api/party/KXRT49/join"), context());

        expect(first.status).toBe(403);
        expect(await first.json()).toEqual(await second.json());
    });

    it("limit tworzenia używa własnej kategorii i zwraca 429", async () => {
        consumeWriteRateLimit.mockResolvedValue(true);

        const response = await createPOST(post("http://localhost/api/party", {
            series_key: "Steins Gate",
            episode_key: "01.mp4",
        }));

        expect(response.status).toBe(429);
        expect(consumeWriteRateLimit).toHaveBeenCalledWith(USER.id, "party-create", 10, 900);
        expect(createPartyRoom).not.toHaveBeenCalled();
    });

    it("heartbeat ma kategorię party-heartbeat, nie progress", async () => {
        await heartbeatPOST(post("http://localhost/api/party/KXRT49/heartbeat"), context());

        expect(consumeWriteRateLimit).toHaveBeenCalledWith(USER.id, "party-heartbeat", 120, 900);
        expect(consumeWriteRateLimit).not.toHaveBeenCalledWith(USER.id, "progress", expect.anything(), expect.anything());
    });

    it("GET zwraca pełny stan i no-store", async () => {
        const response = await stateGET(new Request("http://localhost/api/party/KXRT49"), context());
        const body = await response.json() as { room: typeof room };

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(body.room.currentEpisode).toEqual(room.currentEpisode);
        expect(body.room.anchor).toEqual(room.anchor);
        expect(body.room.participants).toEqual([]);
    });

    it("leave przechodzi przez osobny przypadek użycia", async () => {
        const response = await leavePOST(post("http://localhost/api/party/KXRT49/leave"), context());

        expect(response.status).toBe(200);
        expect(leavePartyRoom).toHaveBeenCalledWith(USER, "KXRT49");
    });

    it("dołączenie bez ciała żądania działa tak samo jak z pustym obiektem", async () => {
        const bodiless = new Request("http://localhost/api/party/KXRT49/join", { method: "POST" });

        const response = await joinPOST(bodiless, context());

        expect(response.status).toBe(200);
        expect(joinPartyRoom).toHaveBeenCalledWith(USER, "KXRT49");
    });

    it("wyjście bez ciała żądania też przechodzi", async () => {
        const bodiless = new Request("http://localhost/api/party/KXRT49/leave", { method: "POST" });

        expect((await leavePOST(bodiless, context())).status).toBe(200);
    });

    it("uszkodzony JSON nadal jest odrzucany", async () => {
        const malformed = new Request("http://localhost/api/party/KXRT49/join", {
            method: "POST",
            body: "{nie-json",
        });

        expect((await joinPOST(malformed, context())).status).toBe(422);
        expect(joinPartyRoom).not.toHaveBeenCalled();
    });
});
