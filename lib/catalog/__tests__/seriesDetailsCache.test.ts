import { afterEach, describe, expect, it, vi } from "vitest";
import type { SeriesDetails } from "@/lib/catalog/getSeriesDetailsAction";
import { createSeriesDetailsCache, mergeSeriesDetailsMetadata, reuseSeriesDetailsMetadata } from "../seriesDetailsCache";

const details = (id = 1): SeriesDetails => ({
    id, seriesKey: `series-${id}`, title: `Title ${id}`, synopsis: "Description", bannerImage: "/banner.webp",
    year: 2026, rating: "8.5", isLocal: true, metadataPending: false, hasSynopsis: true,
    resumeEpisodeKey: "02.mp4", episodes: [{
        key: "02.mp4", title: "Episode 2", number: 2, thumbnail: "/still.webp", url: "/signed-token",
        positionSeconds: 400, percent: 90, watched: true,
    }],
});

afterEach(() => vi.restoreAllMocks());

describe("series details metadata cache", () => {
    it("retains descriptors without retaining progress or signed playback URLs", () => {
        const cache = createSeriesDetailsCache();
        const original = details();
        cache.set(original);
        expect(cache.get(1)).toEqual({ ...original, resumeEpisodeKey: null, episodes: [{
            ...original.episodes[0], url: null, positionSeconds: 0, percent: 0, watched: false,
        }] });
        expect(original.episodes[0].url).toBe("/signed-token");
        expect(original.episodes[0].watched).toBe(true);
    });

    it("isolates each viewer cache and returned objects", () => {
        const cache = createSeriesDetailsCache();
        cache.set(details());
        cache.get(1)!.episodes[0].title = "Changed";
        expect(cache.get(1)!.episodes[0].title).toBe("Episode 2");
        expect(createSeriesDetailsCache().get(1)).toBeNull();
        cache.clear();
        expect(cache.get(1)).toBeNull();
    });

    it("expires metadata after one minute", () => {
        const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
        const cache = createSeriesDetailsCache();
        cache.set(details());
        clock.mockReturnValue(60_999);
        expect(cache.get(1)).not.toBeNull();
        clock.mockReturnValue(61_000);
        expect(cache.get(1)).toBeNull();
    });

    it("evicts the least recently used title after twenty entries", () => {
        const cache = createSeriesDetailsCache();
        for (let id = 1; id <= 20; id++) cache.set(details(id));
        cache.get(1);
        cache.set(details(21));
        expect(cache.get(2)).toBeNull();
        expect(cache.get(1)).not.toBeNull();
        expect(cache.get(21)).not.toBeNull();
    });

    it("supports legacy IDs that resolve to a different catalog ID", () => {
        const cache = createSeriesDetailsCache();
        cache.set(details(1_000_001), 90_000);
        expect(cache.get(90_000)?.id).toBe(1_000_001);
        cache.delete(90_000);
        expect(cache.get(90_000)).toBeNull();
    });

    it("merges late metadata without replacing fresh progress, episodes or playback URLs", () => {
        const fresh = details();
        const outdated = { ...details(), synopsis: "Enriched description", resumeEpisodeKey: null, episodes: [] };
        const merged = mergeSeriesDetailsMetadata(fresh, outdated);
        expect(merged.synopsis).toBe("Enriched description");
        expect(merged.episodes).toBe(fresh.episodes);
        expect(merged.resumeEpisodeKey).toBe("02.mp4");
        expect(mergeSeriesDetailsMetadata(fresh, details(2))).toBe(fresh);
    });

    it("reuses resolved metadata while keeping current progress and newly available metadata", () => {
        const fresh = { ...details(), metadataPending: true, synopsis: "Updated by administrator", year: 2027, bannerImage: null, rating: "Local", episodes: [] };
        const merged = reuseSeriesDetailsMetadata(fresh, details());
        expect(merged).toMatchObject({ synopsis: "Updated by administrator", year: 2027, bannerImage: "/banner.webp", rating: "8.5", metadataPending: false });
        expect(merged.episodes).toBe(fresh.episodes);
    });

    it("fills a placeholder synopsis but never applies metadata from another title", () => {
        const fresh = { ...details(), metadataPending: true, hasSynopsis: false, synopsis: "Fallback description" };
        expect(reuseSeriesDetailsMetadata(fresh, details()).synopsis).toBe("Description");
        expect(reuseSeriesDetailsMetadata(fresh, details(2))).toBe(fresh);
        expect(reuseSeriesDetailsMetadata(fresh, { ...details(), metadataPending: true })).toBe(fresh);
        expect(reuseSeriesDetailsMetadata(details(), details(2)).synopsis).toBe("Description");
    });
});
