import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));
const parsePreviewGrant = vi.fn();
const verifyPreviewGrant = vi.fn();
vi.mock("@/lib/player/previewSigning", () => ({ parsePreviewGrant, verifyPreviewGrant }));
const buildGrantedPreviewClip = vi.fn();
vi.mock("@/lib/player/previewService", () => ({ buildGrantedPreviewClip }));
const findGrantedPreviewAsset = vi.fn();
vi.mock("@/lib/player/previewRepository", () => ({ findGrantedPreviewAsset }));
const buildShortPreviewManifest = vi.fn();
vi.mock("@/lib/player/previewHlsService", () => ({ buildShortPreviewManifest }));
const canStreamSeries = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ canStreamSeries }));

const clipRoute = await import("@/app/api/preview/clip/route");
const hlsRoute = await import("@/app/api/preview/hls/route");
const request = () => new Request("http://localhost/api/preview/grant?x=1");
const baseGrant = {
    profileId: 11, assetId: 42, assetVersion: 7, seriesKey: "Test", episodeKey: "01.mp4",
    variant: 480, firstSegment: 1, lastSegment: 2, expiresAt: 1999999999,
};

beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({ id: 1, username: "user" });
    resolveOwnedProfileId.mockResolvedValue(11);
    verifyPreviewGrant.mockReturnValue(true);
    canStreamSeries.mockResolvedValue(true);
});

describe("podpisane zasoby preview", () => {
    it("zmieniony podpis jest odrzucany przed odczytem assetu", async () => {
        parsePreviewGrant.mockReturnValue({ grant: { ...baseGrant, kind: "hls" }, signature: "bad" });
        verifyPreviewGrant.mockReturnValue(false);
        expect((await hlsRoute.GET(request())).status).toBe(403);
        expect(findGrantedPreviewAsset).not.toHaveBeenCalled();
    });

    it("wygasly grant HLS daje 410", async () => {
        parsePreviewGrant.mockReturnValue({ grant: { ...baseGrant, kind: "hls", expiresAt: 1 }, signature: "valid" });
        expect((await hlsRoute.GET(request())).status).toBe(410);
        expect(findGrantedPreviewAsset).not.toHaveBeenCalled();
    });

    it("grant innego profilu daje 403", async () => {
        parsePreviewGrant.mockReturnValue({ grant: { ...baseGrant, kind: "hls", profileId: 12 }, signature: "valid" });
        expect((await hlsRoute.GET(request())).status).toBe(403);
    });

    it("wlasny grant bez uprawnienia do serialu daje 403 na obu sciezkach", async () => {
        canStreamSeries.mockResolvedValue(false);
        parsePreviewGrant.mockReturnValue({ grant: { ...baseGrant, kind: "hls" }, signature: "valid" });
        expect((await hlsRoute.GET(request())).status).toBe(403);
        expect(findGrantedPreviewAsset).not.toHaveBeenCalled();

        parsePreviewGrant.mockReturnValue({ grant: { ...baseGrant, kind: "clip", variant: 0, firstSegment: -1, lastSegment: -1 }, signature: "valid" });
        expect((await clipRoute.GET(request())).status).toBe(403);
        expect(buildGrantedPreviewClip).not.toHaveBeenCalled();
    });

    it("HLS zwraca tylko przygotowany krotki manifest", async () => {
        parsePreviewGrant.mockReturnValue({ grant: { ...baseGrant, kind: "hls" }, signature: "valid" });
        findGrantedPreviewAsset.mockResolvedValue({ id: 42 });
        buildShortPreviewManifest.mockResolvedValue({ ok: true, body: "#EXTM3U\n#EXT-X-ENDLIST\n" });
        const response = await hlsRoute.GET(request());
        expect(response.status).toBe(200);
        expect(await response.text()).not.toContain("#EXT-X-STREAM-INF");
        expect(buildShortPreviewManifest).toHaveBeenCalledWith({ id: 42 }, 480, 1, 2);
    });

    it("clip aktualnego profilu przekierowuje do krotko podpisanego B2", async () => {
        parsePreviewGrant.mockReturnValue({ grant: { ...baseGrant, kind: "clip", variant: 0, firstSegment: -1, lastSegment: -1 }, signature: "valid" });
        buildGrantedPreviewClip.mockResolvedValue({ ok: true, url: "https://b2.example/preview.mp4" });
        const response = await clipRoute.GET(request());
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe("https://b2.example/preview.mp4");
    });
});
