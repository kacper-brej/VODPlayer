import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/core/contracts";

const mocks = vi.hoisted(() => ({ session: vi.fn(), visibility: vi.fn(), grants: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.session }));
vi.mock("@/lib/access/seriesAccessRepository", () => ({
    findSeriesVisibility: mocks.visibility, loadUserGrants: mocks.grants,
}));

const { canStreamSeries, getViewerEntitlements } = await import("../entitlements");
const viewer = { id: 1, username: "viewer", email: "viewer@example.test", role: "viewer", onboardedAt: null } satisfies AuthUser;

describe("playback entitlements", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.visibility.mockResolvedValue("restricted");
        mocks.grants.mockResolvedValue(["A"]);
        mocks.session.mockResolvedValue(viewer);
    });

    it("uses the already verified viewer without reading the session again", async () => {
        expect(await canStreamSeries(viewer, "A")).toBe(true);
        expect(mocks.session).not.toHaveBeenCalled();
        expect(mocks.grants).toHaveBeenCalledExactlyOnceWith(viewer.id);
    });

    it("reads the session once when loading catalog entitlements", async () => {
        const result = await getViewerEntitlements();
        expect(result.accessFor("A", "restricted")).toBe("full");
        expect(mocks.session).toHaveBeenCalledOnce();
    });

    it("does not share grants between different viewers", async () => {
        mocks.grants.mockImplementation(async (id: number) => id === 1 ? ["A"] : []);
        expect(await canStreamSeries(viewer, "A")).toBe(true);
        expect(await canStreamSeries({ ...viewer, id: 2 }, "A")).toBe(false);
    });

    it("honors revoked grants on the next request", async () => {
        expect(await canStreamSeries(viewer, "A")).toBe(true);
        mocks.grants.mockResolvedValue([]);
        expect(await canStreamSeries(viewer, "A")).toBe(false);
    });
});
