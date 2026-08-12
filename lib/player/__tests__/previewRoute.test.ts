import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
const createPreviewSession = vi.fn();
vi.mock("@/lib/player/previewService", () => ({ createPreviewSession }));

const canStreamSeries = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ canStreamSeries }));

const { GET } = await import("@/app/api/preview/route");
beforeEach(() => {
    vi.clearAllMocks();
    canStreamSeries.mockResolvedValue(true);
});
const request = (query: string) => new Request(`http://localhost/api/preview?${query}`);

describe("GET /api/preview — decyzja sesyjna", () => {
    it("wymaga aktywnej sesji", async () => {
        getSessionUser.mockResolvedValue(null);
        expect((await GET(request("s=Test&e=01.mp4"))).status).toBe(401);
        expect(createPreviewSession).not.toHaveBeenCalled();
    });

    it("odrzuca traversal i nie przyjmuje pozycji klienta", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "user" });
        expect((await GET(request("s=../Test&e=01.mp4&position=999"))).status).toBe(400);
        expect(createPreviewSession).not.toHaveBeenCalled();
    });

    it("nie przygotowuje podgladu bez uprawnienia do serialu", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "user", role: "viewer" });
        canStreamSeries.mockResolvedValue(false);
        expect((await GET(request("s=Test&e=01.mp4"))).status).toBe(403);
        expect(createPreviewSession).not.toHaveBeenCalled();
    });

    it("przekazuje tylko bezpieczna tozsamosc do server-authoritative service", async () => {
        getSessionUser.mockResolvedValue({ id: 1, username: "user" });
        createPreviewSession.mockResolvedValue({
            ok: true,
            source: { mode: "preview", type: "mp4", src: "/api/preview/clip?x", expiresAt: 1999999999, sourceTimelineStartSeconds: 30, mediaOffsetSeconds: 0, durationSeconds: 10, reason: "editorial" },
        });
        const response = await GET(request("s=Test&e=01.mp4&position=999&reduceData=1"));
        expect(response.status).toBe(200);
        expect(createPreviewSession).toHaveBeenCalledWith(1, "user", "Test", "01.mp4", true);
        expect(response.headers.get("cache-control")).toBe("no-store");
    });
});
