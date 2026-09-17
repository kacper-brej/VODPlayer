import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn(), record: vi.fn(), accept: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/http/routeAuth", () => ({ requireSessionRoute: mocks.session, requireAdminRoute: mocks.admin }));
vi.mock("@/lib/performance/store", () => ({ getPerformanceStore: () => ({ record: mocks.record, acceptReporter: mocks.accept, snapshot: mocks.snapshot }) }));
import { GET, POST } from "@/app/api/performance/route";

const metric = { id: "v1", name: "LCP", value: 1200, page: "home", device: "mobile", delivery: "page" };
const request = (body = JSON.stringify([metric]), origin = "https://example.test") => new Request("https://example.test/api/performance", { method: "POST", headers: { origin }, body });

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
    mocks.session.mockResolvedValue({ ok: true, user: { id: 1 } });
    mocks.admin.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    mocks.accept.mockReturnValue(true);
});

describe("performance endpoint", () => {
    it("requires same-origin requests and authentication before recording", async () => {
        expect((await POST(request(undefined, "https://other.test"))).status).toBe(403);
        expect(mocks.session).not.toHaveBeenCalled();
        mocks.session.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
        expect((await POST(request())).status).toBe(401);
        expect(mocks.record).not.toHaveBeenCalled();
    });
    it("rejects malformed and oversized input without storing it", async () => {
        expect((await POST(request("{"))).status).toBe(400);
        expect((await POST(request("x".repeat(12001)))).status).toBe(413);
        expect((await POST(request("[]"))).status).toBe(400);
        expect(mocks.record).not.toHaveBeenCalled();
    });
    it("rate limits batches and returns uncached success for valid data", async () => {
        mocks.accept.mockReturnValueOnce(false);
        expect((await POST(request())).status).toBe(429);
        const response = await POST(request());
        expect(response.status).toBe(204);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(mocks.record).toHaveBeenCalledWith([metric]);
    });
    it("exposes aggregated results only to administrators", async () => {
        expect((await GET()).status).toBe(403);
        expect(mocks.snapshot).not.toHaveBeenCalled();
        mocks.admin.mockResolvedValue({ ok: true });
        mocks.snapshot.mockReturnValue({ rows: [] });
        expect(await (await GET()).json()).toEqual({ rows: [] });
    });
});
