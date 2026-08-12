import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionRoute = vi.fn();
vi.mock("@/lib/http/routeAuth", () => ({ requireSessionRoute }));

const consumeWriteRateLimit = vi.fn();
vi.mock("@/lib/http/writeRateLimit", () => ({ consumeWriteRateLimit }));

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));

const getUserSeriesAccessLevel = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ getUserSeriesAccessLevel }));

const findPartyByCode = vi.fn();
const findMemberRole = vi.fn();
vi.mock("@/lib/party/partyRepository", () => ({ findPartyByCode, findMemberRole }));

const issueChannelToken = vi.fn();
vi.mock("@/lib/party/realtimeChannel", async () => {
    const actual = await vi.importActual<typeof import("../realtimeChannel")>("../realtimeChannel");
    return { issueChannelToken, PartyChannelError: actual.PartyChannelError };
});

const { PartyChannelError } = await import("../realtimeChannel");
const { POST } = await import("@/app/api/party/[code]/channel-token/route");

const NOW = 1_700_000_000_000;

const snapshot = (overrides: Record<string, unknown> = {}) => ({
    serverNowMs: NOW,
    party: {
        id: 5,
        roomCode: "KXRT49",
        hostProfileId: 10,
        seriesKey: "Steins Gate",
        episodeKey: "01.mp4",
        controlMode: "host",
        anchor: { state: "paused", positionSeconds: 0, anchorAtMs: NOW, anchorVersion: 0 },
        createdAtMs: NOW - 1000,
        expiresAtMs: NOW + 3_600_000,
        closedAtMs: null,
        ...overrides,
    },
});

const call = (code = "KXRT49") =>
    POST(new Request("http://localhost/api/party/KXRT49/channel-token", { method: "POST" }), {
        params: Promise.resolve({ code }),
    });

beforeEach(() => {
    vi.clearAllMocks();
    requireSessionRoute.mockResolvedValue({ ok: true, user: { id: 1, username: "kacper" } });
    consumeWriteRateLimit.mockResolvedValue(false);
    resolveOwnedProfileId.mockResolvedValue(10);
    getUserSeriesAccessLevel.mockResolvedValue("full");
    findPartyByCode.mockResolvedValue(snapshot());
    findMemberRole.mockResolvedValue("host");
    issueChannelToken.mockResolvedValue({
        channelName: "party:KXRT49",
        streamUrl: "https://stream.example.test/sse?v=1.2&channels=party%3AKXRT49&accessToken=abc",
        expiresAtMs: NOW + 900_000,
    });
});

describe("POST /api/party/[code]/channel-token", () => {
    it("wymaga sesji", async () => {
        requireSessionRoute.mockResolvedValue({
            ok: false,
            response: new Response(null, { status: 401 }),
        });

        expect((await call()).status).toBe(401);
        expect(issueChannelToken).not.toHaveBeenCalled();
    });

    it("odmawia kontu, które nie jest uczestnikiem pokoju", async () => {
        findMemberRole.mockResolvedValue(null);

        const response = await call();

        expect(response.status).toBe(404);
        expect(issueChannelToken).not.toHaveBeenCalled();
    });

    it("nie wydaje tokenu uczestnikowi, który utracił pełny dostęp do tytułu", async () => {
        getUserSeriesAccessLevel.mockResolvedValue("demo");

        const response = await call();

        expect(response.status).toBe(404);
        expect(issueChannelToken).not.toHaveBeenCalled();
    });

    it("odmowa dla obcego konta jest nieodróżnialna od nieistniejącego pokoju", async () => {
        findMemberRole.mockResolvedValue(null);
        const outsider = await (await call()).json() as { error: string };

        findPartyByCode.mockResolvedValue(null);
        const missing = await (await call()).json() as { error: string };

        expect(outsider.error).toBe(missing.error);
    });

    it("zamknięty pokój nie wydaje tokenu", async () => {
        findPartyByCode.mockResolvedValue(snapshot({ closedAtMs: NOW - 1 }));

        expect((await call()).status).toBe(404);
        expect(issueChannelToken).not.toHaveBeenCalled();
    });

    it("wygasły pokój nie wydaje tokenu", async () => {
        findPartyByCode.mockResolvedValue(snapshot({ expiresAtMs: NOW - 1 }));

        expect((await call()).status).toBe(404);
    });

    it("kod w złym formacie jest odrzucany przed zapytaniem do bazy", async () => {
        expect((await call("../../etc")).status).toBe(404);
        expect(findPartyByCode).not.toHaveBeenCalled();
    });

    it("uczestnik dostaje adres strumienia i czas wygaśnięcia, bez sekretów", async () => {
        const response = await call();
        const body = await response.json() as Record<string, unknown>;

        expect(response.status).toBe(200);
        expect(body).toEqual({
            streamUrl: "https://stream.example.test/sse?v=1.2&channels=party%3AKXRT49&accessToken=abc",
            expiresAtMs: NOW + 900_000,
        });
        expect(Object.keys(body)).not.toContain("channelName");
        expect(response.headers.get("Cache-Control")).toBe("no-store");
    });

    it("nadużycie odświeżania tokenu kończy się limitem", async () => {
        consumeWriteRateLimit.mockResolvedValue(true);

        expect((await call()).status).toBe(429);
        expect(findPartyByCode).not.toHaveBeenCalled();
    });

    it("limit tokenu ma własną kategorię, nie budżet zapisu postępu", async () => {
        await call();

        expect(consumeWriteRateLimit).toHaveBeenCalledWith(1, "party-token", 60, 900);
    });

    it("wyłączona funkcja daje 503, a nie błąd serwera", async () => {
        issueChannelToken.mockRejectedValue(new PartyChannelError("disabled", "Wspólne oglądanie jest wyłączone."));

        expect((await call()).status).toBe(503);
    });

    it("awaria usługi kanału daje 502", async () => {
        issueChannelToken.mockRejectedValue(new PartyChannelError("upstream", "Usługa kanału nie odpowiada."));

        expect((await call()).status).toBe(502);
    });

    it("nieoczekiwany błąd nie wycieka swojej treści", async () => {
        findPartyByCode.mockRejectedValue(new Error("SELECT ... FROM watch_parties"));

        const response = await call();
        const body = await response.json() as { error: string };

        expect(response.status).toBe(500);
        expect(body.error).not.toContain("SELECT");
    });
});
