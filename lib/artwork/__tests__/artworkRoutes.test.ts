import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextResponse } from "next/server";

const requireAdminRoute = vi.fn();
const saveManualArtwork = vi.fn();
const buildArtworkRedirect = vi.fn();
const invalidateCatalogCache = vi.fn();

vi.mock("@/lib/http/routeAuth", () => ({ requireAdminRoute }));
vi.mock("@/lib/catalog/seriesMetadata", () => ({ invalidateCatalogCache }));
vi.mock("@/lib/artwork/artworkService", () => ({
    saveManualArtwork,
    buildArtworkRedirect,
    isSafeArtworkSeriesKey: (value: string) => value.length > 0 && !/[\\/]/.test(value),
    isArtworkKind: (value: string) => ["poster", "backdrop", "logo"].includes(value),
}));

const adminRoute = await import("@/app/api/admin/artwork/route");
const publicRoute = await import("@/app/api/artwork/route");

const uploadRequest = () => {
    const body = new FormData();
    body.set("seriesKey", "Test");
    body.set("kind", "poster");
    body.set("file", new File(["image"], "poster.png", { type: "image/png" }));
    return new Request("http://localhost/api/admin/artwork", { method: "POST", body });
};

beforeEach(() => vi.clearAllMocks());

describe("POST /api/admin/artwork", () => {
    it("odrzucenie przez gate zatrzymuje trase przed odczytaniem pliku", async () => {
        requireAdminRoute.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Brak uprawnień." }, { status: 403 }),
        });
        const response = await adminRoute.POST(uploadRequest());
        expect(response.status).toBe(403);
        expect(saveManualArtwork).not.toHaveBeenCalled();
    });

    it("zapisuje przez TS, odswieza katalog i zwraca stabilny URL", async () => {
        requireAdminRoute.mockResolvedValue({ ok: true, user: { id: 1, role: "admin" } });
        saveManualArtwork.mockResolvedValue({ ok: true, id: 9, url: "/api/artwork?id=9" });

        const response = await adminRoute.POST(uploadRequest());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, id: 9, url: "/api/artwork?id=9" });
        expect(saveManualArtwork).toHaveBeenCalledWith("Test", "poster", expect.any(Buffer));
        expect(invalidateCatalogCache).toHaveBeenCalledOnce();
    });
});

describe("GET /api/artwork", () => {
    it("odrzuca niepoprawne id bez dostepu do bazy", async () => {
        const response = await publicRoute.GET(new Request("http://localhost/api/artwork?id=../../etc"));
        expect(response.status).toBe(400);
        expect(buildArtworkRedirect).not.toHaveBeenCalled();
    });

    it("zwraca cacheowalny redirect do krotko zyjacego URL-a B2", async () => {
        buildArtworkRedirect.mockResolvedValue({ ok: true, url: "https://b2.example/signed" });
        const response = await publicRoute.GET(new Request("http://localhost/api/artwork?id=9"));
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe("https://b2.example/signed");
        expect(response.headers.get("cache-control")).toContain("max-age=300");
        expect(buildArtworkRedirect).toHaveBeenCalledWith(9);
    });
});
