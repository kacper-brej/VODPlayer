import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSessionUser: vi.fn(), searchTmdb: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/search/searchTmdb", () => ({ searchTmdb: mocks.searchTmdb }));

import { GET } from "@/app/api/search/tmdb/route";

const request = (query: string) => new Request(`http://localhost/api/search/tmdb?q=${encodeURIComponent(query)}`);

beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: 9, username: "viewer" });
    mocks.searchTmdb.mockResolvedValue([{ id: 10, title: "Title", year: 2024, href: "/series/tmdb%3A10", poster: null }]);
});

afterEach(() => vi.restoreAllMocks());

describe("TMDB search GET", () => {
    it("authenticates before provider work and returns private results", async () => {
        const response = await GET(request("  night & day  "));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(await mocks.searchTmdb.mock.results[0].value);
        expect(mocks.searchTmdb).toHaveBeenCalledExactlyOnceWith("night & day", expect.any(AbortSignal));
        expect(mocks.getSessionUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.searchTmdb.mock.invocationCallOrder[0]);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    it("does not query the provider without a session", async () => {
        mocks.getSessionUser.mockResolvedValue(null);
        const response = await GET(request("title"));
        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(mocks.searchTmdb).not.toHaveBeenCalled();
    });

    it.each(["", " a ", "x".repeat(121)])("rejects an invalid query before provider work", async (query) => {
        const response = await GET(request(query));
        expect(response.status).toBe(400);
        expect(mocks.searchTmdb).not.toHaveBeenCalled();
    });

    it("skips provider work when cancellation arrives during authentication", async () => {
        const controller = new AbortController();
        mocks.getSessionUser.mockImplementationOnce(async () => {
            controller.abort();
            return { id: 9 };
        });
        const response = await GET(new Request("http://localhost/api/search/tmdb?q=title", { signal: controller.signal }));
        expect(response.status).toBe(204);
        expect(mocks.searchTmdb).not.toHaveBeenCalled();
    });

    it("runs a new lookup while an earlier lookup is still pending", async () => {
        let resolveFirst!: (value: unknown[]) => void;
        mocks.searchTmdb.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
        const first = GET(request("old"));
        const second = await GET(request("new"));
        expect(second.status).toBe(200);
        expect(mocks.searchTmdb).toHaveBeenCalledTimes(2);
        resolveFirst([]);
        expect((await first).status).toBe(200);
    });

    it("keeps unexpected failures private", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.searchTmdb.mockRejectedValue(new Error("unavailable"));
        const response = await GET(request("title"));
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual([]);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
    });
});
