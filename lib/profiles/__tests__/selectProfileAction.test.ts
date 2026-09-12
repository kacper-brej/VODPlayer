import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getProfiles: vi.fn(),
    getCatalog: vi.fn(),
    getLatestResume: vi.fn(),
    getProfileSettingsRow: vi.fn(),
    resolvePreviewSource: vi.fn(),
    setCookie: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/profiles/profiles", () => ({ getProfiles: mocks.getProfiles }));
vi.mock("@/lib/catalog/catalog", () => ({ getCatalog: mocks.getCatalog }));
vi.mock("@/lib/progress/continueWatching", () => ({ getLatestResume: mocks.getLatestResume }));
vi.mock("@/lib/settings/settingsRepository", () => ({ getProfileSettingsRow: mocks.getProfileSettingsRow }));
vi.mock("@/lib/player/videoAccess", () => ({ resolvePreviewSource: mocks.resolvePreviewSource }));

import selectProfileAction from "@/lib/profiles/selectProfileAction";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: 9, username: "viewer" });
    mocks.getProfiles.mockResolvedValue({ kind: "success", data: [{ id: 12, name: "Profile" }] });
    mocks.getProfileSettingsRow.mockResolvedValue({ autoPreviewsEnabled: true, reduceData: false });
    mocks.getCatalog.mockResolvedValue({ kind: "success", data: [catalogSeriesFixture("series")] });
    mocks.getLatestResume.mockResolvedValue({ kind: "empty", data: null });
    mocks.resolvePreviewSource.mockReturnValue({ kind: "session", src: "/api/preview?s=series&e=01.mp4", startSeconds: 0 });
});

describe("selectProfileAction preloading", () => {
    it("loads metadata without playback URLs for an owned profile", async () => {
        const result = await selectProfileAction(12);

        expect(result).toMatchObject({ success: true, previewSource: { kind: "session" } });
        expect(mocks.getCatalog).toHaveBeenCalledWith(false);
        expect(mocks.getProfileSettingsRow).toHaveBeenCalledWith(12);
        expect(mocks.setCookie).toHaveBeenCalledTimes(1);
    });

    it("selects the profile without preparing preview data when the device opts out", async () => {
        expect(await selectProfileAction(12, false)).toEqual({ success: true, previewSource: null });

        expect(mocks.setCookie).toHaveBeenCalledTimes(1);
        expect(mocks.getProfileSettingsRow).not.toHaveBeenCalled();
        expect(mocks.getCatalog).not.toHaveBeenCalled();
        expect(mocks.getLatestResume).not.toHaveBeenCalled();
    });

    it.each([
        { autoPreviewsEnabled: false, reduceData: false },
        { autoPreviewsEnabled: true, reduceData: true },
    ])("respects the selected profile preferences %j", async (settings) => {
        mocks.getProfileSettingsRow.mockResolvedValue(settings);

        expect(await selectProfileAction(12)).toEqual({ success: true, previewSource: null });

        expect(mocks.getCatalog).not.toHaveBeenCalled();
        expect(mocks.getLatestResume).not.toHaveBeenCalled();
    });

    it("keeps a completed profile selection when optional preview lookup fails", async () => {
        mocks.getProfileSettingsRow.mockRejectedValue(new Error("unavailable"));

        expect(await selectProfileAction(12)).toEqual({ success: true, previewSource: null });

        expect(mocks.setCookie).toHaveBeenCalledTimes(1);
        expect(mocks.getCatalog).not.toHaveBeenCalled();
    });

    it.each(["unauthorized", "not_found"])("does not read private settings after %s selection", async (error) => {
        if (error === "unauthorized") mocks.getSessionUser.mockResolvedValue(null);

        expect(await selectProfileAction(13)).toEqual({ success: false, error });

        expect(mocks.setCookie).not.toHaveBeenCalled();
        expect(mocks.getProfileSettingsRow).not.toHaveBeenCalled();
        expect(mocks.getCatalog).not.toHaveBeenCalled();
    });
});
