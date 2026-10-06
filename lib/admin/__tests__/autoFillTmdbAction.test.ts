import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), lookup: vi.fn(), search: vi.fn(), match: vi.fn(), details: vi.fn(), artwork: vi.fn(), persist: vi.fn(), decision: vi.fn(), tag: vi.fn() }));
vi.mock("next/cache", () => ({ updateTag: mocks.tag }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/seriesMetadata/seriesMetadataService", () => ({ getSeriesMetadata: mocks.lookup, saveReviewDecision: mocks.decision, selectSeriesArtwork: vi.fn(), undoManualSeriesMetadata: vi.fn() }));
vi.mock("@/lib/metadata/registry", () => ({ getProvider: () => ({ getSeries: mocks.details, getArtwork: mocks.artwork }), resolveSeriesIdentity: vi.fn() }));
vi.mock("@/lib/metadata/searchAdminTmdb", () => ({ searchAdminTmdb: mocks.search, uniqueTmdbMatch: mocks.match }));
vi.mock("@/lib/metadata/persistIdentity", () => ({ persistSeriesIdentity: mocks.persist }));
vi.mock("@/lib/upload/uploadWorkflowActions", () => ({ getUploadWorkflowSetup: vi.fn(), saveSeriesMetadataAction: vi.fn() }));
vi.mock("@/lib/admin/episodeStillsBackfillAction", () => ({ refreshSeriesEpisodeStillsAction: vi.fn() }));
vi.mock("@/lib/seriesGroups/seriesGroupService", () => ({ assignSeriesToGroup: vi.fn() }));
import { autoFillTmdbAction, setMetadataReviewDecisionAction } from "../metadataReviewActions";

beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: 1, role: "admin" });
    mocks.lookup.mockResolvedValue({ externalIds: { tmdb: "movie:2" } });
    mocks.details.mockResolvedValue({ kind: "success", data: { title: "Film" } });
    mocks.artwork.mockResolvedValue({ kind: "success", data: [] });
    mocks.persist.mockResolvedValue(true);
});
describe("automatyczne uzupełnianie danych", () => {
    it.each([null, { role: "user" }])("odrzuca brak uprawnień przed odczytem i zapisem", async (user) => {
        mocks.user.mockResolvedValue(user);
        expect((await autoFillTmdbAction("Film")).kind).toBe("error");
        expect(mocks.lookup).not.toHaveBeenCalled();
        expect(mocks.persist).not.toHaveBeenCalled();
    });
    it("używa zapisanego ID, oznacza dobór jako automatyczny i odświeża katalog", async () => {
        expect(await autoFillTmdbAction("Film")).toEqual({ kind: "success", data: { status: "saved" } });
        expect(mocks.search).not.toHaveBeenCalled();
        expect(mocks.details).toHaveBeenCalledWith("movie:2");
        expect(mocks.persist).toHaveBeenCalledWith("Film", "tmdb", "movie:2", { title: "Film" }, [], "auto");
        expect(mocks.tag).toHaveBeenCalled();
    });
    it("nie zapisuje niejednoznacznego dopasowania", async () => {
        mocks.lookup.mockResolvedValue({ externalIds: {} });
        mocks.search.mockResolvedValue({ kind: "success", data: [{ title: "Film" }, { title: "Film" }] });
        mocks.match.mockReturnValue(null);
        expect(await autoFillTmdbAction("Film")).toEqual({ kind: "success", data: { status: "choose" } });
        expect(mocks.persist).not.toHaveBeenCalled();
    });
    it("nie zgłasza sukcesu, gdy pobranie grafik się nie udało", async () => {
        mocks.artwork.mockResolvedValue({ kind: "error", reason: "network" });
        expect(await autoFillTmdbAction("Film")).toEqual({ kind: "error", reason: "network" });
        expect(mocks.persist).not.toHaveBeenCalled();
        expect(mocks.decision).not.toHaveBeenCalled();
    });
    it("pozwala odłożyć materiał bez plakatu", async () => {
        expect((await setMetadataReviewDecisionAction("Film", "skipped", "missing-poster")).kind).toBe("success");
        expect(mocks.decision).toHaveBeenCalledWith("Film", { state: "skipped", reason: null });
    });
});
