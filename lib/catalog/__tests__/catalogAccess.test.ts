import { describe, expect, it, vi } from "vitest";
import type { CatalogResponse, CatalogSeriesPayload, SeriesVisibility, UserRole } from "@/lib/core/contracts";
import { resolveSeriesAccess } from "@/lib/access/seriesAccessService";
import type { ViewerEntitlements } from "@/lib/access/entitlements";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/player/videoAccess", () => ({
    signedManifestUrl: (assetId: number, assetVersion: number, seriesKey: string, episodeKey: string) =>
        `/api/hls?a=${assetId}&ver=${assetVersion}&s=${seriesKey}&e=${episodeKey}&sig=test`,
}));

const { applyViewerAccess } = await import("@/lib/catalog/catalog");

const series = (key: string, visibility: SeriesVisibility): CatalogSeriesPayload => ({
    id: 1_000_001,
    key,
    title: key,
    updatedAt: 1_700_000_000,
    groupId: null,
    baseTitle: null,
    seasonNumber: null,
    coverImage: "/poster.jpg",
    posterImage: "/poster.jpg",
    backdropImage: null,
    backdropSource: null,
    logoImage: null,
    synopsis: null,
    rating: null,
    ageRating: null,
    year: null,
    focalX: null,
    focalY: null,
    safeLeft: null,
    safeBottom: null,
    dominantColor: null,
    placeholder: null,
    posterDominantColor: null,
    posterPlaceholder: null,
    backdropDominantColor: null,
    backdropPlaceholder: null,
    studio: null,
    audioLanguages: [],
    subtitleLanguages: [],
    metadataProvider: null,
    externalId: null,
    tmdbExternalId: null,
    genres: [],
    altTitles: [],
    hasMetadata: true,
    visibility,
    episodeCount: 1,
    episodes: [{
        key: "01.mp4",
        number: 1,
        sizeBytes: 1024,
        addedAt: 1_700_000_000,
        title: null,
        synopsis: null,
        durationSeconds: 1440,
        thumbnail: null,
        media: {
            assetId: 42,
            assetVersion: 7,
            status: "ready", delivery: "hls",
            heights: [720],
            previewStartSeconds: null,
            hasPreviewClip: false,
        },
    }],
});

const payload: CatalogResponse = {
    generatedAt: 1_700_000_000,
    series: [series("Tokyo Ghoul", "restricted"), series("Big Buck Bunny", "public")],
};

const viewerWithGrants = (role: UserRole | undefined, grants: string[]): ViewerEntitlements => ({
    role,
    accessFor: (seriesKey, visibility) => resolveSeriesAccess({
        role,
        visibility,
        hasGrant: grants.includes(seriesKey),
    }),
});

describe("adresy materiału w payloadzie katalogu", () => {
    it("widz bez uprawnienia nie dostaje adresu chronionego tytułu", () => {
        const result = applyViewerAccess(payload, viewerWithGrants("viewer", []));
        const protectedSeries = result.find((entry) => entry.key === "Tokyo Ghoul");

        expect(protectedSeries?.access).toBe("demo");
        expect(protectedSeries?.episodes[0]?.url).toBeNull();
    });

    it("tytuł publiczny dostaje podpisany adres nawet bez uprawnienia", () => {
        const result = applyViewerAccess(payload, viewerWithGrants("viewer", []));
        const publicSeries = result.find((entry) => entry.key === "Big Buck Bunny");

        expect(publicSeries?.access).toBe("full");
        expect(publicSeries?.episodes[0]?.url).toContain("/api/hls?");
    });

    it("ten sam payload daje różne adresy dwóm różnym kontom", () => {
        const withoutGrant = applyViewerAccess(payload, viewerWithGrants("viewer", []));
        const withGrant = applyViewerAccess(payload, viewerWithGrants("viewer", ["Tokyo Ghoul"]));

        expect(withoutGrant.find((entry) => entry.key === "Tokyo Ghoul")?.episodes[0]?.url).toBeNull();
        expect(withGrant.find((entry) => entry.key === "Tokyo Ghoul")?.episodes[0]?.url).toContain("/api/hls?");
    });

    it("admin dostaje adresy do wszystkiego", () => {
        const result = applyViewerAccess(payload, viewerWithGrants("admin", []));

        expect(result.every((entry) => entry.access === "full")).toBe(true);
        expect(result.every((entry) => entry.episodes[0]?.url !== null)).toBe(true);
    });

    it("z materiałem demonstracyjnym chroniony tytuł dostaje adres klipu, nie własnego assetu", () => {
        const demo = {
            assetId: 99,
            assetVersion: 3,
            seriesKey: "_demo",
            episodeKey: "demo.mp4",
            durationSeconds: 600,
            heights: [480],
        };
        const result = applyViewerAccess(payload, viewerWithGrants("viewer", []), demo);
        const protectedSeries = result.find((entry) => entry.key === "Tokyo Ghoul");

        expect(protectedSeries?.access).toBe("demo");
        expect(protectedSeries?.episodes[0]?.url).toContain("a=99");
        expect(protectedSeries?.episodes[0]?.url).toContain("s=_demo");
        expect(protectedSeries?.episodes[0]?.url).not.toContain("a=42");
    });

    it("materiał demonstracyjny nie zmienia adresu tytułu, do którego widz ma prawo", () => {
        const demo = {
            assetId: 99,
            assetVersion: 3,
            seriesKey: "_demo",
            episodeKey: "demo.mp4",
            durationSeconds: 600,
            heights: [480],
        };
        const result = applyViewerAccess(payload, viewerWithGrants("viewer", ["Tokyo Ghoul"]), demo);
        const protectedSeries = result.find((entry) => entry.key === "Tokyo Ghoul");

        expect(protectedSeries?.access).toBe("full");
        expect(protectedSeries?.episodes[0]?.url).toContain("a=42");
        expect(protectedSeries?.episodes[0]?.url).toContain("s=Tokyo Ghoul");
    });

    it("kafelek chronionego tytułu zachowuje metadane i okładkę", () => {
        const result = applyViewerAccess(payload, viewerWithGrants("viewer", []));
        const protectedSeries = result.find((entry) => entry.key === "Tokyo Ghoul");

        expect(protectedSeries?.title).toBe("Tokyo Ghoul");
        expect(protectedSeries?.coverImage).toBe("/poster.jpg");
        expect(protectedSeries?.episodeCount).toBe(1);
        expect(protectedSeries?.episodes[0]?.durationSeconds).toBe(1440);
    });
});
