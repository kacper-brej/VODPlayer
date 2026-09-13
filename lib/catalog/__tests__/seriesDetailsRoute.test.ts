import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataEmpty, dataFailure, dataSuccess } from "@/lib/core/dataResult";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getSeriesDetailsAction: vi.fn(),
    consumeWriteRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/catalog/getSeriesDetailsAction", () => ({ default: mocks.getSeriesDetailsAction }));
vi.mock("@/lib/http/writeRateLimit", () => ({ consumeWriteRateLimit: mocks.consumeWriteRateLimit }));

import { GET, POST } from "@/app/api/series/details/route";

const request = (method = "GET", id = "1000001") => new Request(`http://localhost/api/series/details?id=${id}`, { method });
const expectPrivate = (response: Response) => {
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: 9, username: "viewer" });
    mocks.getSeriesDetailsAction.mockResolvedValue(dataSuccess({ id: 1_000_001, metadataPending: true }));
    mocks.consumeWriteRateLimit.mockResolvedValue(false);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("series details route", () => {
    it("GET requests only authenticated base data without initiating a metadata mutation", async () => {
        const response = await GET(request());

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(dataSuccess({ id: 1_000_001, metadataPending: true }));
        expect(mocks.getSeriesDetailsAction).toHaveBeenCalledWith(1_000_001, false);
        expect(mocks.consumeWriteRateLimit).not.toHaveBeenCalled();
        expectPrivate(response);
    });

    it("GET preserves an authentication failure from the details service", async () => {
        mocks.getSeriesDetailsAction.mockResolvedValue(dataFailure("unauthorized", 401));

        const response = await GET(request());

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual(dataFailure("unauthorized", 401));
        expectPrivate(response);
    });

    it("POST authenticates before consuming a user rate limit or enriching metadata", async () => {
        mocks.getSessionUser.mockResolvedValue(null);

        const response = await POST(request("POST"));

        expect(response.status).toBe(401);
        expect(mocks.consumeWriteRateLimit).not.toHaveBeenCalled();
        expect(mocks.getSeriesDetailsAction).not.toHaveBeenCalled();
        expectPrivate(response);
    });

    it("POST stops before external work when the metadata write limit is exhausted", async () => {
        mocks.consumeWriteRateLimit.mockResolvedValue(true);

        const response = await POST(request("POST"));

        expect(response.status).toBe(429);
        expect(mocks.consumeWriteRateLimit).toHaveBeenCalledWith(9, "series_metadata", 60, 900);
        expect(mocks.getSeriesDetailsAction).not.toHaveBeenCalled();
        expectPrivate(response);
    });

    it("POST enriches metadata only after authentication and the write limit pass", async () => {
        const response = await POST(request("POST"));

        expect(response.status).toBe(200);
        expect(mocks.getSeriesDetailsAction).toHaveBeenCalledWith(1_000_001, true);
        expect(mocks.getSessionUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.consumeWriteRateLimit.mock.invocationCallOrder[0]);
        expect(mocks.consumeWriteRateLimit.mock.invocationCallOrder[0]).toBeLessThan(mocks.getSeriesDetailsAction.mock.invocationCallOrder[0]);
        expectPrivate(response);
    });

    it.each(["", "-1", "1.5", "1e6", "9007199254740992"])("rejects invalid identifiers without upstream work: %s", async (id) => {
        const response = await POST(request("POST", id));

        expect(response.status).toBe(400);
        expect(mocks.getSeriesDetailsAction).not.toHaveBeenCalled();
        expect(mocks.consumeWriteRateLimit).not.toHaveBeenCalled();
        expectPrivate(response);
    });

    it("keeps an unavailable title distinct from a failed lookup", async () => {
        mocks.getSeriesDetailsAction.mockResolvedValue(dataEmpty(null));

        const response = await GET(request());

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(dataEmpty(null));
        expectPrivate(response);
    });

    it.each([
        { reason: "forbidden" as const, status: 403 },
        { reason: "network" as const, status: 500 },
    ])("maps $reason failures to private HTTP errors", async ({ reason, status }) => {
        mocks.getSeriesDetailsAction.mockResolvedValue(dataFailure(reason));

        const response = await GET(request());

        expect(response.status).toBe(status);
        expect(await response.json()).toEqual(dataFailure(reason));
        expectPrivate(response);
    });

    it("returns a private server error if a dependency throws", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.getSeriesDetailsAction.mockRejectedValue(new Error("unavailable"));

        const response = await GET(request());

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual(dataFailure("server", 500));
        expectPrivate(response);
    });
});
