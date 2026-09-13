import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROFILE_COOKIE } from "@/lib/core/vodConfig";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getProfiles: vi.fn(),
    getCatalog: vi.fn(),
    getLatestResume: vi.fn(),
    getProfileSettingsRow: vi.fn(),
    setCookie: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/profiles/profiles", () => ({ getProfiles: mocks.getProfiles }));
vi.mock("@/lib/catalog/catalog", () => ({ getCatalog: mocks.getCatalog }));
vi.mock("@/lib/progress/continueWatching", () => ({ getLatestResume: mocks.getLatestResume }));
vi.mock("@/lib/settings/settingsRepository", () => ({ getProfileSettingsRow: mocks.getProfileSettingsRow }));

import selectProfileAction from "@/lib/profiles/selectProfileAction";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: 9, username: "viewer" });
    mocks.getProfiles.mockResolvedValue({ kind: "success", data: [{ id: 12, name: "Profile" }] });
});

describe("selectProfileAction", () => {
    it("completes selection without waiting for optional preview dependencies", async () => {
        mocks.getCatalog.mockImplementation(() => new Promise(() => undefined));
        mocks.getProfileSettingsRow.mockImplementation(() => new Promise(() => undefined));

        expect(await selectProfileAction(12)).toEqual({ success: true });
        expect(mocks.setCookie).toHaveBeenCalledWith(PROFILE_COOKIE, "12", expect.objectContaining({
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        }));
        expect(mocks.getProfileSettingsRow).not.toHaveBeenCalled();
        expect(mocks.getCatalog).not.toHaveBeenCalled();
        expect(mocks.getLatestResume).not.toHaveBeenCalled();
    });

    it.each(["unauthorized", "not_found"])("does not change cookies after %s selection", async (error) => {
        if (error === "unauthorized") mocks.getSessionUser.mockResolvedValue(null);

        expect(await selectProfileAction(13)).toEqual({ success: false, error });
        expect(mocks.setCookie).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid profile ID %s before listing profiles", async (profileId) => {
        expect(await selectProfileAction(profileId)).toEqual({ success: false, error: "not_found" });
        expect(mocks.getProfiles).not.toHaveBeenCalled();
        expect(mocks.setCookie).not.toHaveBeenCalled();
    });

    it("preserves backend errors and does not change the selected profile", async () => {
        mocks.getProfiles.mockResolvedValue({ kind: "error", reason: "server" });

        expect(await selectProfileAction(12)).toEqual({ success: false, error: "backend" });
        expect(mocks.setCookie).not.toHaveBeenCalled();
    });
});
