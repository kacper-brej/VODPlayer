import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireSessionRoute = vi.fn();
vi.mock("@/lib/http/routeAuth", () => ({ requireSessionRoute }));

const saveProgress = vi.fn();
vi.mock("@/lib/progress/progressService", () => ({ saveProgress }));

const getWatchlist = vi.fn();
const addToWatchlist = vi.fn();
vi.mock("@/lib/watchlist/watchlistService", () => ({ getWatchlist, addToWatchlist }));

const consumeWriteRateLimit = vi.fn();
vi.mock("@/lib/http/writeRateLimit", () => ({ consumeWriteRateLimit }));

const { POST: progressPOST } = await import("../progress/route");
const { GET: watchlistGET, POST: watchlistPOST } = await import("../watchlist/route");

const USER = { id: 1, username: "kacper", email: "k@example.com", role: "viewer" as const };
const blockedGate = (status: number) => ({ ok: false, response: NextResponse.json({ error: "blocked" }, { status }) });

beforeEach(() => {
    vi.clearAllMocks();
    consumeWriteRateLimit.mockResolvedValue(false);
});

describe("requireSessionRoute rollout: POST /api/progress", () => {
    it("gate odrzuca żądanie zanim dotknie serwisu", async () => {
        requireSessionRoute.mockResolvedValue(blockedGate(401));
        const request = new Request("http://localhost/api/progress", { method: "POST", body: "{}" });
        const response = await progressPOST(request);
        expect(response.status).toBe(401);
        expect(saveProgress).not.toHaveBeenCalled();
    });

    it("gate przepuszcza usera do serwisu z jego id i username", async () => {
        requireSessionRoute.mockResolvedValue({ ok: true, user: USER });
        saveProgress.mockResolvedValue({ ok: true, completed: false });
        const request = new Request("http://localhost/api/progress", {
            method: "POST",
            body: JSON.stringify({ series: "Naruto", episode: "01.mp4", position: 10 }),
        });
        const response = await progressPOST(request);
        expect(response.status).toBe(200);
        expect(saveProgress).toHaveBeenCalledWith(USER.id, USER.username, expect.objectContaining({ series: "Naruto" }));
    });
});

describe("requireSessionRoute rollout: /api/watchlist", () => {
    it("GET bez sesji zwraca odpowiedź z gate'u", async () => {
        requireSessionRoute.mockResolvedValue(blockedGate(401));
        const response = await watchlistGET();
        expect(response.status).toBe(401);
        expect(getWatchlist).not.toHaveBeenCalled();
    });

    it("POST przepuszcza usera i respektuje limit zapisu", async () => {
        requireSessionRoute.mockResolvedValue({ ok: true, user: USER });
        consumeWriteRateLimit.mockResolvedValue(true);
        const request = new Request("http://localhost/api/watchlist", {
            method: "POST",
            body: JSON.stringify({ series: "Naruto" }),
        });
        const response = await watchlistPOST(request);
        expect(response.status).toBe(429);
        expect(addToWatchlist).not.toHaveBeenCalled();
        expect(consumeWriteRateLimit).toHaveBeenCalledWith(USER.id, "watchlist", 60, 900);
    });
});
