import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getCookie: vi.fn(),
    isProfileOwnedByUser: vi.fn(),
    getCatalog: vi.fn(),
    getLatestResume: vi.fn(),
    getProfileSettingsRow: vi.fn(),
    resolvePreviewSource: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.getCookie }) }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/profiles/profileRepository", () => ({ isProfileOwnedByUser: mocks.isProfileOwnedByUser }));
vi.mock("@/lib/catalog/catalog", () => ({ getCatalog: mocks.getCatalog }));
vi.mock("@/lib/progress/continueWatching", () => ({ getLatestResume: mocks.getLatestResume }));
vi.mock("@/lib/settings/settingsRepository", () => ({ getProfileSettingsRow: mocks.getProfileSettingsRow }));
vi.mock("@/lib/player/videoAccess", () => ({ resolvePreviewSource: mocks.resolvePreviewSource }));

import { GET } from "@/app/api/profiles/preview/route";

const previewSource = { kind: "session", src: "/api/preview?s=series&e=01.mp4", startSeconds: 0 };
const request = (profileId = "12", signal?: AbortSignal) => new Request(
    `http://localhost/api/profiles/preview?profileId=${profileId}`,
    { signal },
);

beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: 9, username: "viewer" });
    mocks.getCookie.mockReturnValue({ value: "12" });
    mocks.isProfileOwnedByUser.mockResolvedValue(true);
    mocks.getProfileSettingsRow.mockResolvedValue({ autoPreviewsEnabled: true, reduceData: false });
    mocks.getCatalog.mockResolvedValue({ kind: "success", data: [catalogSeriesFixture("series")] });
    mocks.getLatestResume.mockResolvedValue({ kind: "empty", data: null });
    mocks.resolvePreviewSource.mockReturnValue(previewSource);
});

describe("selected profile preview route", () => {
    it("loads metadata for the selected owned profile without caching private data", async () => {
        const response = await GET(request());

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ previewSource });
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(mocks.isProfileOwnedByUser).toHaveBeenCalledWith(12, 9);
        expect(mocks.getProfileSettingsRow).toHaveBeenCalledWith(12);
        expect(mocks.getCatalog).toHaveBeenCalledWith(false);
    });

    it("uses the selected profile resume when choosing the preview", async () => {
        const resumed = catalogSeriesFixture("resumed");
        mocks.getCatalog.mockResolvedValue({ kind: "success", data: [catalogSeriesFixture("series"), resumed] });
        mocks.getLatestResume.mockResolvedValue({
            kind: "success",
            data: { seriesKey: "resumed", episodeKey: resumed.episodes[0].key, positionSeconds: 42 },
        });

        await GET(request());

        expect(mocks.resolvePreviewSource).toHaveBeenCalledWith("resumed", resumed.episodes[0], 42);
    });

    it.each([
        ["unauthorized", 401],
        ["changed profile", 409],
        ["unowned profile", 403],
    ] as const)("rejects %s before private settings and playback lookups", async (reason, status) => {
        if (reason === "unauthorized") mocks.getSessionUser.mockResolvedValue(null);
        if (reason === "changed profile") mocks.getCookie.mockReturnValue({ value: "13" });
        if (reason === "unowned profile") mocks.isProfileOwnedByUser.mockResolvedValue(false);

        const response = await GET(request());

        expect(response.status).toBe(status);
        expect(mocks.getProfileSettingsRow).not.toHaveBeenCalled();
        expect(mocks.getCatalog).not.toHaveBeenCalled();
        expect(mocks.getLatestResume).not.toHaveBeenCalled();
    });

    it.each(["", "0", "-1", "1.5", "invalid", "9007199254740992"])("rejects invalid profile ID %s", async (profileId) => {
        expect((await GET(request(profileId))).status).toBe(400);
        expect(mocks.isProfileOwnedByUser).not.toHaveBeenCalled();
    });

    it.each([
        { autoPreviewsEnabled: false, reduceData: false },
        { autoPreviewsEnabled: true, reduceData: true },
    ])("respects profile preview preferences %j", async (settings) => {
        mocks.getProfileSettingsRow.mockResolvedValue(settings);

        expect(await (await GET(request())).json()).toEqual({ previewSource: null });
        expect(mocks.getCatalog).not.toHaveBeenCalled();
        expect(mocks.getLatestResume).not.toHaveBeenCalled();
    });

    it("stops additional preparation when the warmup request was aborted", async () => {
        const controller = new AbortController();
        controller.abort();

        expect(await (await GET(request("12", controller.signal))).json()).toEqual({ previewSource: null });
        expect(mocks.getCatalog).not.toHaveBeenCalled();
    });

    it("returns an uncached empty response when optional preview preparation fails", async () => {
        mocks.getProfileSettingsRow.mockRejectedValue(new Error("unavailable"));

        const response = await GET(request());

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ previewSource: null });
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });
});
