import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTmdbSearch } from "../loadTmdbSearch";

const hit = { id: 10, title: "Title", year: 2024, href: "/series/tmdb%3A10", poster: null };

afterEach(() => vi.unstubAllGlobals());

describe("TMDB search requests", () => {
    it("encodes the complete query and uses a private cancellable GET", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json([hit]));
        vi.stubGlobal("fetch", fetchMock);
        const signal = new AbortController().signal;

        expect(await loadTmdbSearch("  Łódź & night  ", signal)).toEqual([hit]);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/search/tmdb?q=%C5%81%C3%B3d%C5%BA%20%26%20night", {
            credentials: "same-origin", cache: "no-store", signal,
        });
    });

    it.each(["", " x ", "x".repeat(121)])("skips invalid queries without a request: %s", async (query) => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        expect(await loadTmdbSearch(query, new AbortController().signal)).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not start a request that was already cancelled", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const controller = new AbortController();
        controller.abort();
        expect(await loadTmdbSearch("title", controller.signal)).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("cancels a stale request without blocking the next query", async () => {
        let aborted = false;
        vi.stubGlobal("fetch", vi.fn()
            .mockImplementationOnce((_url: string, options: RequestInit) => new Promise((_, reject) => {
                options.signal!.addEventListener("abort", () => {
                    aborted = true;
                    reject(new DOMException("Aborted", "AbortError"));
                }, { once: true });
            }))
            .mockResolvedValueOnce(Response.json([hit])));
        const controller = new AbortController();
        const first = loadTmdbSearch("old", controller.signal).catch((error: Error) => error.name);
        const second = loadTmdbSearch("new", new AbortController().signal);
        controller.abort();

        expect(await first).toBe("AbortError");
        expect(aborted).toBe(true);
        expect(await second).toEqual([hit]);
    });

    it("discards a response cancelled while its body was loading", async () => {
        let resolveBody!: (value: unknown) => void;
        const json = vi.fn(() => new Promise((resolve) => { resolveBody = resolve; }));
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json }));
        const controller = new AbortController();
        const pending = loadTmdbSearch("title", controller.signal);
        await vi.waitFor(() => expect(json).toHaveBeenCalled());
        controller.abort();
        resolveBody([hit]);

        expect(await pending).toEqual([]);
    });

    it.each([401, 403, 429, 500])("keeps local results usable after HTTP %s", async (status) => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([hit], { status })));
        expect(await loadTmdbSearch("title", new AbortController().signal)).toEqual([]);
    });

    it.each([{ hits: [hit] }, [null], [{ ...hit, href: "https://other.test" }], [{ ...hit, id: -1 }]])(
        "rejects malformed search payloads", async (payload) => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
            expect(await loadTmdbSearch("title", new AbortController().signal)).toEqual([]);
        },
    );
});
