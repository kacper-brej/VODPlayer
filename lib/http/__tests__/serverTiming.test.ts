import { afterEach, describe, expect, it, vi } from "vitest";
import { withServerTiming } from "../serverTiming";

afterEach(() => vi.restoreAllMocks());

describe("private endpoint timing", () => {
    it("reports stage and total durations without changing the response or adding request data", async () => {
        let time = 0;
        vi.spyOn(performance, "now").mockImplementation(() => time);
        const response = await withServerTiming(async (timing) => {
            await timing.measure("session", async () => { time = 10; });
            await timing.measure("manifest", async () => { time = 30; });
            timing.playlistCache("hit");
            return new Response("private-body", { headers: { "Cache-Control": "no-store" } });
        });
        expect(response.headers.get("server-timing")).toBe('session;dur=10.0, manifest;dur=20.0, playlist_cache;desc="hit", total;dur=30.0');
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).toBe("private-body");
    });
    it("times rejected stages without including exception details", async () => {
        const response = await withServerTiming(async (timing) => {
            try { await timing.measure("access", async () => { throw new Error("private-query"); }); }
            catch { return new Response(null, { status: 500 }); }
            return new Response(null);
        });
        expect(response.status).toBe(500);
        expect(response.headers.get("server-timing")).toMatch(/^access;dur=[\d.]+, total;dur=[\d.]+$/);
    });
});
