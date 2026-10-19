import { beforeEach, describe, expect, it, vi } from "vitest";
import { reuseRequestRead } from "@/lib/http/requestReadScope";

const mocks = vi.hoisted(() => ({ user: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/http/routeAuth", () => ({
    requireSessionRoute: async () => {
        const user = await reuseRequestRead("session-user", mocks.user);
        return user ? { ok: true, user } : { ok: false, response: new Response(null, { status: 401 }) };
    },
}));
vi.mock("@/lib/player/resolveWatchData", () => ({ resolveWatchData: mocks.resolve }));
import { GET } from "@/app/api/watch/route";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: 1, role: "viewer" });
    mocks.resolve.mockImplementation(async () => {
        await Promise.all(Array.from({ length: 4 }, () => reuseRequestRead("session-user", mocks.user)));
        return { kind: "success", data: { fileName: "2.mp4" } };
    });
});
const request = () => new Request("http://localhost/api/watch?id=1&ep=2.mp4");

describe("watch API read scope", () => {
    it("shares the gate's user with subsequent reads without caching the HTTP response", async () => {
        const result = await GET(request());
        expect(result.status).toBe(200);
        expect(result.headers.get("cache-control")).toBe("private, no-store");
        expect(result.headers.get("server-timing")).toMatch(/session;dur=.*watch_data;dur=.*total;dur=/);
        expect(mocks.user).toHaveBeenCalledTimes(1);
        expect(mocks.resolve).toHaveBeenCalledWith("1", "2.mp4");
        await GET(request());
        expect(mocks.user).toHaveBeenCalledTimes(2);
    });
    it("checks authorization again after a session is revoked", async () => {
        await GET(request());
        mocks.user.mockResolvedValue(null);
        expect((await GET(request())).status).toBe(401);
        expect(mocks.resolve).toHaveBeenCalledTimes(1);
    });
    it("does not reuse an old access decision", async () => {
        await GET(request());
        mocks.resolve.mockResolvedValue({ kind: "error", status: 403, message: "Brak dostępu" });
        expect((await GET(request())).status).toBe(403);
        expect(mocks.resolve).toHaveBeenCalledTimes(2);
    });
    it("rejects invalid requests before the watch data lookup", async () => {
        expect((await GET(new Request("http://localhost/api/watch?id=1"))).status).toBe(400);
        expect(mocks.resolve).not.toHaveBeenCalled();
    });
});
