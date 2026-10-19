import { describe, expect, it } from "vitest";
import { createSignedPlaylistCache } from "../signedPlaylistCache";

describe("signed playlist memory budget", () => {
    it("expires entries exactly at their deadline, including hits", () => {
        let time = 0;
        const cache = createSignedPlaylistCache({ now: () => time });
        cache.set("a", "body", 60);
        time = 59;
        expect(cache.get("a")).toBe("body");
        time = 60;
        expect(cache.get("a")).toBeNull();
    });
    it("evicts the least recently used entry at the entry limit", () => {
        const cache = createSignedPlaylistCache({ now: () => 0, maxEntries: 2 });
        cache.set("a", "a", 60); cache.set("b", "b", 60);
        cache.get("a");
        cache.set("c", "c", 60);
        expect(cache.get("b")).toBeNull();
        expect(cache.get("a")).toBe("a");
        expect(cache.get("c")).toBe("c");
    });
    it("bounds string storage, skips oversized items and resets accounting on clear", () => {
        const cache = createSignedPlaylistCache({ now: () => 0, maxBytes: 12 });
        cache.set("a", "123", 60); // 8 bytes
        cache.set("b", "123", 60);
        expect(cache.get("a")).toBeNull();
        cache.set("large", "1234567", 60);
        expect(cache.get("large")).toBeNull();
        expect(cache.get("b")).toBe("123");
        cache.clear();
        cache.set("c", "12345", 60);
        expect(cache.get("c")).toBe("12345");
    });
    it("removes expired items before evicting valid ones and accounts for replacement", () => {
        let time = 0;
        const cache = createSignedPlaylistCache({ now: () => time, maxBytes: 12 });
        cache.set("a", "1", 60);
        cache.set("b", "1", 1);
        time = 2;
        cache.set("c", "123", 60);
        expect(cache.get("a")).toBe("1");
        cache.set("c", "1", 60);
        cache.set("d", "1", 60);
        expect(cache.get("a")).toBe("1");
        expect(cache.get("d")).toBe("1");
        cache.set("d", "expired", 1);
        expect(cache.get("d")).toBeNull();
    });
});
