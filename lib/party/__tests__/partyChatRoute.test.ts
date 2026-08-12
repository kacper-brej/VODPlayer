import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionRoute = vi.fn();
vi.mock("@/lib/http/routeAuth", () => ({ requireSessionRoute }));

const consumeWriteRateLimit = vi.fn();
vi.mock("@/lib/http/writeRateLimit", () => ({ consumeWriteRateLimit }));

const postPartyMessage = vi.fn();
vi.mock("@/lib/party/partyChatService", () => ({ postPartyMessage }));

const { POST } = await import("@/app/api/party/[code]/chat/route");

const USER = {
    id: 1,
    username: "kacper",
    email: "k@example.com",
    role: "viewer" as const,
    onboardedAt: "2026-08-01T00:00:00.000Z",
};

const event = {
    type: "chat",
    roomCode: "KXRT49",
    eventAtMs: 1_700_000_000_500,
    message: { id: 42, profileId: 10, body: "cześć", createdAtMs: 1_700_000_000_500 },
};

const call = (body: unknown = { body: "cześć" }, code = "KXRT49") => POST(
    new Request("http://localhost/api/party/KXRT49/chat", {
        method: "POST",
        body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ code }) },
);

beforeEach(() => {
    vi.clearAllMocks();
    requireSessionRoute.mockResolvedValue({ ok: true, user: USER });
    consumeWriteRateLimit.mockResolvedValue(false);
    postPartyMessage.mockResolvedValue({ ok: true, event });
});

describe("POST /api/party/[code]/chat", () => {
    it("wymaga sesji", async () => {
        requireSessionRoute.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });

        expect((await call()).status).toBe(401);
        expect(postPartyMessage).not.toHaveBeenCalled();
    });

    it("zapisana wiadomość wraca jako zatwierdzone zdarzenie", async () => {
        const response = await call();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ event });
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(postPartyMessage).toHaveBeenCalledWith(USER, "KXRT49", "cześć");
    });

    it("nieprawidłowa treść daje 422", async () => {
        postPartyMessage.mockResolvedValue({ ok: false, code: "invalid" });

        expect((await call()).status).toBe(422);
    });

    it("konto spoza pokoju dostaje tę samą odpowiedź co nieistniejący pokój", async () => {
        postPartyMessage.mockResolvedValue({ ok: false, code: "unavailable" });

        expect((await call()).status).toBe(403);
    });

    it("nadużycie częstotliwości nie dotyka warstwy serwisu", async () => {
        consumeWriteRateLimit.mockResolvedValue(true);

        expect((await call()).status).toBe(429);
        expect(postPartyMessage).not.toHaveBeenCalled();
    });

    it("limit czatu ma własną kategorię, nie dzieli budżetu z komendami ani z zapisem postępu", async () => {
        await call();

        expect(consumeWriteRateLimit).toHaveBeenCalledWith(USER.id, "party-chat", 30, 60);
    });

    it("nieoczekiwany błąd nie wycieka swojej treści", async () => {
        postPartyMessage.mockRejectedValue(new Error("INSERT INTO watch_party_messages ..."));

        const response = await call();
        const body = await response.json() as { error: string };

        expect(response.status).toBe(500);
        expect(body.error).not.toContain("INSERT");
    });

    it("kod pokoju w złym formacie jest odrzucony przed wywołaniem serwisu", async () => {
        expect((await call({ body: "cześć" }, "")).status).toBe(422);
        expect(postPartyMessage).not.toHaveBeenCalled();
    });
});
