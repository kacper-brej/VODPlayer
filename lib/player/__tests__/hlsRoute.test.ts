import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

const buildManifest = vi.fn();
vi.mock("@/lib/player/hlsService", () => ({
    buildManifest,
    HLS_MANIFEST_PATH: "/api/hls",
}));

const verifyHlsManifestSignature = vi.fn();
vi.mock("@/lib/player/hlsSigning", () => ({
    verifyHlsManifestSignature,
    isHlsVariant: (value: string) => ["master", "480", "720", "1080"].includes(value),
}));

const canStreamSeries = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ canStreamSeries }));

const { GET } = await import("@/app/api/hls/route");

beforeEach(() => {
    vi.clearAllMocks();
    canStreamSeries.mockResolvedValue(true);
});

const request = (overrides = "") => new Request(
    `http://localhost/api/hls?a=42&ver=7&s=Test&e=01.mp4&v=master&exp=1999999999&sig=valid${overrides}`,
);

describe("GET /api/hls", () => {
    it("wymaga aktywnej sesji", async () => {
        getSessionUser.mockResolvedValue(null);
        expect((await GET(request())).status).toBe(401);
    });

    it("odrzuca zmieniona tozsamosc assetu przez podpis", async () => {
        getSessionUser.mockResolvedValue({ id: 1 });
        verifyHlsManifestSignature.mockReturnValue(false);
        expect((await GET(request("&a=43"))).status).toBe(403);
        expect(buildManifest).not.toHaveBeenCalled();
    });

    it("zwraca 410 dla poprawnie podpisanego, wygaslego URL", async () => {
        getSessionUser.mockResolvedValue({ id: 1 });
        verifyHlsManifestSignature.mockReturnValue(true);
        const expired = new Request("http://localhost/api/hls?a=42&ver=7&s=Test&e=01.mp4&v=master&exp=1&sig=valid");
        expect((await GET(expired)).status).toBe(410);
    });

    it("odrzuca poprawnie podpisany adres bez uprawnienia do serialu", async () => {
        getSessionUser.mockResolvedValue({ id: 1, role: "viewer" });
        verifyHlsManifestSignature.mockReturnValue(true);
        canStreamSeries.mockResolvedValue(false);
        expect((await GET(request())).status).toBe(403);
        expect(buildManifest).not.toHaveBeenCalled();
    });

    it("awaria sprawdzenia uprawnienia nie wpuszcza do materialu", async () => {
        getSessionUser.mockResolvedValue({ id: 1, role: "viewer" });
        verifyHlsManifestSignature.mockReturnValue(true);
        canStreamSeries.mockRejectedValue(new Error("db down"));
        expect((await GET(request())).status).toBe(500);
        expect(buildManifest).not.toHaveBeenCalled();
    });

    it("mapuje brak wersjonowanego assetu na 404", async () => {
        getSessionUser.mockResolvedValue({ id: 1 });
        verifyHlsManifestSignature.mockReturnValue(true);
        buildManifest.mockResolvedValue({ ok: false, code: "not_found" });
        expect((await GET(request())).status).toBe(404);
    });

    it("mapuje awarie B2 na 502 bez ujawniania szczegolow", async () => {
        getSessionUser.mockResolvedValue({ id: 1 });
        verifyHlsManifestSignature.mockReturnValue(true);
        buildManifest.mockResolvedValue({ ok: false, code: "storage" });
        const response = await GET(request());
        expect(response.status).toBe(502);
        expect(await response.text()).not.toContain("B2_READ_APP_KEY");
    });

    it("przekazuje zweryfikowana tozsamosc do pojedynczego odczytu manifestu", async () => {
        getSessionUser.mockResolvedValue({ id: 1 });
        verifyHlsManifestSignature.mockReturnValue(true);
        buildManifest.mockResolvedValue({ ok: true, body: "#EXTM3U\n" });
        const response = await GET(request());
        expect(response.status).toBe(200);
        expect(buildManifest).toHaveBeenCalledWith(42, 7, "Test", "01.mp4", "master", 1999999999, "/api/hls");
    });
});
