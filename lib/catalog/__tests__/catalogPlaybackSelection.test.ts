import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "./catalogSeriesFixture";

const mocks = vi.hoisted(() => ({
    build: vi.fn(), entitlements: vi.fn(), demo: vi.fn(), sign: vi.fn(), file: vi.fn(),
    virtual: vi.fn(), parseVirtual: vi.fn(), access: vi.fn(),
}));

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/catalog/catalogService", () => ({ buildCatalog: mocks.build }));
vi.mock("@/lib/access/entitlements", () => ({ getViewerEntitlements: mocks.entitlements }));
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset: mocks.demo }));
vi.mock("@/lib/player/videoAccess", () => ({ signedManifestUrl: mocks.sign, signedFileStreamUrl: mocks.file }));
vi.mock("@/lib/catalog/tmdbVirtualSeries", () => ({
    getVirtualTmdbTitle: mocks.virtual, parseVirtualTmdbRef: mocks.parseVirtual,
}));

const { getCatalog, resolveCatalogSeries } = await import("../catalog");

const series = (key: string, id: number) => {
    const item = catalogSeriesFixture(key, { id });
    item.episodes[0].media = {
        assetId: id, assetVersion: 2, status: "ready", delivery: "hls",
        heights: [720], previewStartSeconds: null, hasPreviewClip: false,
    };
    return item;
};

describe("catalog selection for playback", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.build.mockResolvedValue({ generatedAt: 1, series: [series("A", 1_000_001), series("B", 1_000_002)] });
        mocks.access.mockReturnValue("full");
        mocks.entitlements.mockResolvedValue({ role: "viewer", accessFor: mocks.access });
        mocks.demo.mockResolvedValue(null);
        mocks.parseVirtual.mockReturnValue(null);
        mocks.sign.mockReturnValue("/signed");
    });

    it.each(["B", "1000002", "90002"])("signs only the selected series for %s", async (query) => {
        expect(await resolveCatalogSeries(query)).toMatchObject({ kind: "success", data: { key: "B" } });
        expect(mocks.sign).toHaveBeenCalledExactlyOnceWith(1_000_002, 2, "B", "01.mp4", "master");
        expect(mocks.access).toHaveBeenCalledExactlyOnceWith("B", "public");
    });

    it("keeps the legacy positional fallback", async () => {
        expect(await resolveCatalogSeries("90000", false)).toMatchObject({ kind: "success", data: { key: "A" } });
    });

    it("loads watch metadata without signing URLs or fetching the unused demo", async () => {
        const result = await resolveCatalogSeries("A", false);
        expect(result).toMatchObject({ kind: "success", data: {
            key: "A", access: "full", episodes: [{ key: "01.mp4", url: null, media: { assetId: 1_000_001 } }],
        } });
        expect(mocks.sign).not.toHaveBeenCalled();
        expect(mocks.file).not.toHaveBeenCalled();
        expect(mocks.demo).not.toHaveBeenCalled();
    });

    it("loads catalog metadata without generating playback URLs", async () => {
        const result = await getCatalog(false);
        expect(result).toMatchObject({ kind: "success", data: [
            { key: "A", access: "full", episodes: [{ url: null }] },
            { key: "B", access: "full", episodes: [{ url: null }] },
        ] });
        expect(mocks.sign).not.toHaveBeenCalled();
        expect(mocks.file).not.toHaveBeenCalled();
        expect(mocks.demo).not.toHaveBeenCalled();
    });

    it("preserves catalog playback URLs by default", async () => {
        const result = await getCatalog();
        expect(result).toMatchObject({ kind: "success", data: [
            { key: "A", episodes: [{ url: "/signed" }] },
            { key: "B", episodes: [{ url: "/signed" }] },
        ] });
        expect(mocks.sign).toHaveBeenCalledTimes(2);
    });

    it("preserves the restricted series access decision without generating protected URLs", async () => {
        mocks.access.mockReturnValue("demo");
        expect(await resolveCatalogSeries("A", false)).toMatchObject({ kind: "success", data: { access: "demo" } });
        expect(mocks.sign).not.toHaveBeenCalled();
    });

    it("preserves demo URLs for consumers that request them", async () => {
        mocks.access.mockReturnValue("demo");
        mocks.demo.mockResolvedValue({ assetId: 99, assetVersion: 3, seriesKey: "demo", episodeKey: "demo.mp4", heights: [480] });
        await resolveCatalogSeries("A");
        expect(mocks.sign).toHaveBeenCalledExactlyOnceWith(99, 3, "demo", "demo.mp4", "master");
    });

    it("preserves file playback URLs", async () => {
        const item = series("File", 5);
        item.episodes[0].media!.delivery = "file";
        mocks.build.mockResolvedValue({ generatedAt: 1, series: [item] });
        mocks.file.mockReturnValue("/file");
        expect(await resolveCatalogSeries("File")).toMatchObject({ kind: "success", data: { episodes: [{ url: "/file" }] } });
        expect(mocks.file).toHaveBeenCalledExactlyOnceWith("File", "01.mp4");
        expect(mocks.sign).not.toHaveBeenCalled();
    });

    it("preserves virtual title lookup", async () => {
        const ref = { kind: "tv", tmdbId: 20 };
        mocks.parseVirtual.mockReturnValue(ref);
        mocks.virtual.mockResolvedValue({ kind: "success", data: { key: "virtual" } });
        expect(await resolveCatalogSeries("virtual", false)).toMatchObject({ data: { key: "virtual" } });
        expect(mocks.virtual).toHaveBeenCalledExactlyOnceWith(ref);
    });

    it("does not sign unrelated episodes when the requested series is missing", async () => {
        expect(await resolveCatalogSeries("missing")).toMatchObject({ kind: "empty", data: null });
        expect(mocks.sign).not.toHaveBeenCalled();
    });
});
