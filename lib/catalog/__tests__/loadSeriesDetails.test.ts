import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSeriesDetails } from "../loadSeriesDetails";

afterEach(() => vi.unstubAllGlobals());

describe("series details requests", () => {
    it.each([false, true])("loads enrich=%s with private uncached requests and an abort signal", async (enrich) => {
        const result = { kind: "empty", data: null };
        const fetchMock = vi.fn().mockResolvedValue(Response.json(result));
        vi.stubGlobal("fetch", fetchMock);
        const signal = new AbortController().signal;
        expect(await loadSeriesDetails(123, enrich, signal)).toEqual(result);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/series/details?id=123", {
            method: enrich ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal,
        });
    });

    it.each([[401, "unauthorized"], [403, "forbidden"], [429, "server"], [500, "server"]])("handles HTTP %s without trusting its JSON shape", async (status, reason) => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Unavailable" }, { status: Number(status) })));
        expect(await loadSeriesDetails(123, false, new AbortController().signal)).toEqual({ kind: "error", reason, status });
    });

    it("handles malformed response envelopes and disconnected requests", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ unexpected: true })).mockRejectedValueOnce(new Error("offline"));
        vi.stubGlobal("fetch", fetchMock);
        expect(await loadSeriesDetails(123, false, new AbortController().signal)).toMatchObject({ kind: "error", reason: "invalid_response" });
        expect(await loadSeriesDetails(123, false, new AbortController().signal)).toMatchObject({ kind: "error", reason: "network" });
    });
});
