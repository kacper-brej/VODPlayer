import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

vi.mock("@/lib/db/transaction", () => ({ withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}) }));
const repo = {
    loadProgressSnapshot: vi.fn(),
    findReadyMediaAsset: vi.fn(),
    upsertWatchProgress: vi.fn(),
    resetWatchProgressForRewatch: vi.fn(),
    markPlayCountedToday: vi.fn(),
    incrementWeeklyPlayCount: vi.fn(),
};
vi.mock("@/lib/progress/progressRepository", () => repo);
const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));
const getViewerSeriesAccessLevel = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ getViewerSeriesAccessLevel }));
const getDemoAsset = vi.fn();
vi.mock("@/lib/access/demoAsset", () => ({ getDemoAsset }));
const { getContinueWatching, getProgressSnapshot, getSeriesProgress, resetProgressForRewatch, saveProgress } = await import("../progressService");

const ASSET = { id: 8, seriesKey: "Naruto", episodeKey: "01.mp4", durationSeconds: 1200 };
beforeEach(() => {
    vi.clearAllMocks();
    resolveOwnedProfileId.mockResolvedValue(5);
    getViewerSeriesAccessLevel.mockResolvedValue("full");
    getDemoAsset.mockResolvedValue(null);
    repo.loadProgressSnapshot.mockResolvedValue({ episodesBySeries: {}, resumes: [] });
    repo.findReadyMediaAsset.mockResolvedValue(ASSET);
    repo.upsertWatchProgress.mockResolvedValue(false);
    repo.markPlayCountedToday.mockResolvedValue(false);
});

describe("wspólny read model", () => {
    it("rozwiązuje wyłącznie profil należący do aktualnego usera", async () => {
        await getProgressSnapshot(1, "Kacper", ["Naruto"]);
        expect(resolveOwnedProfileId).toHaveBeenCalledWith(1, "Kacper");
        expect(repo.loadProgressSnapshot).toHaveBeenCalledWith(5, ["Naruto"]);
    });

    it("Continue Watching pochodzi z tego samego snapshotu", async () => {
        const resumes = [{ seriesKey: "Naruto", episodeKey: "01.mp4", positionSeconds: 10, durationSeconds: 1200, updatedAt: 1 }];
        repo.loadProgressSnapshot.mockResolvedValue({ episodesBySeries: {}, resumes });
        await expect(getContinueWatching(1, "Kacper")).resolves.toEqual(resumes);
    });

    it("seria używa jednego zbiorczego zapytania zamiast osobnych episodes/resume", async () => {
        repo.loadProgressSnapshot.mockResolvedValue({ episodesBySeries: { Naruto: { "01.mp4": { positionSeconds: 10, durationSeconds: 1200, completed: false, updatedAt: 1 } } }, resumes: [] });
        await getSeriesProgress(1, "Kacper", "Naruto");
        expect(repo.loadProgressSnapshot).toHaveBeenCalledTimes(1);
    });
});

describe("bezpieczny zapis", () => {
    it("odrzuca nieistniejący albo niedostępny asset", async () => {
        repo.findReadyMediaAsset.mockResolvedValue(null);
        await expect(saveProgress(1, "Kacper", { series: "Ghost", episode: "01", position: 10 })).resolves.toEqual({ ok: false, code: "unavailable" });
        expect(repo.upsertWatchProgress).not.toHaveBeenCalled();
    });

    it("bez pełnego dostępu i bez skonfigurowanego demo nie zapisuje postępu", async () => {
        getViewerSeriesAccessLevel.mockResolvedValue("demo");
        await expect(saveProgress(1, "Kacper", { series: "Tokyo Ghoul", episode: "01.mp4", position: 10 }))
            .resolves.toEqual({ ok: false, code: "unavailable" });
        expect(repo.upsertWatchProgress).not.toHaveBeenCalled();
    });

    it("w trybie demo zapisuje asset demonstracyjny pod prawdziwym tytułem i odcinkiem", async () => {
        getViewerSeriesAccessLevel.mockResolvedValue("demo");
        getDemoAsset.mockResolvedValue({
            assetId: 99, assetVersion: 3, seriesKey: "_demo", episodeKey: "demo.mp4",
            durationSeconds: 600, heights: [480],
        });
        repo.findReadyMediaAsset.mockResolvedValue({ ...ASSET, seriesKey: "Tokyo Ghoul", episodeKey: "01.mp4" });

        await saveProgress(1, "Kacper", { series: "Tokyo Ghoul", episode: "01.mp4", position: 300 });

        expect(repo.upsertWatchProgress).toHaveBeenCalledWith(
            5,
            { id: 99, version: 3, seriesKey: "Tokyo Ghoul", episodeKey: "01.mp4", durationSeconds: 600 },
            300,
            false,
            {},
        );
    });

    it("w trybie demo pozycja jest clampowana do długości klipu, a ukończenie liczone w jego skali", async () => {
        getViewerSeriesAccessLevel.mockResolvedValue("demo");
        getDemoAsset.mockResolvedValue({
            assetId: 99, assetVersion: 3, seriesKey: "_demo", episodeKey: "demo.mp4",
            durationSeconds: 600, heights: [480],
        });
        repo.findReadyMediaAsset.mockResolvedValue({ ...ASSET, seriesKey: "Tokyo Ghoul", episodeKey: "01.mp4" });

        await saveProgress(1, "Kacper", { series: "Tokyo Ghoul", episode: "01.mp4", position: 5000 });

        expect(repo.upsertWatchProgress).toHaveBeenCalledWith(
            5, expect.objectContaining({ id: 99 }), 600, true, {},
        );
    });

    it("demo nie tworzy postępu dla odcinka, którego nie ma w bibliotece", async () => {
        getViewerSeriesAccessLevel.mockResolvedValue("demo");
        getDemoAsset.mockResolvedValue({
            assetId: 99, assetVersion: 3, seriesKey: "_demo", episodeKey: "demo.mp4",
            durationSeconds: 600, heights: [480],
        });
        repo.findReadyMediaAsset.mockResolvedValue(null);

        await expect(saveProgress(1, "Kacper", { series: "Zmyślony", episode: "99.mp4", position: 10 }))
            .resolves.toEqual({ ok: false, code: "unavailable" });
        expect(repo.upsertWatchProgress).not.toHaveBeenCalled();
    });

    it("duration pochodzi wyłącznie z assetu i position jest clampowane", async () => {
        await saveProgress(1, "Kacper", { series: "Naruto", episode: "01.mp4", position: 9999 });
        expect(repo.upsertWatchProgress).toHaveBeenCalledWith(5, ASSET, 1200, true, {});
    });

    it("fikcyjne pola klienta nie mogą zmienić duration ani rankingu", async () => {
        await saveProgress(1, "Kacper", { series: "Naruto", episode: "01.mp4", position: 10, duration: 10 } as never);
        expect(repo.upsertWatchProgress).toHaveBeenCalledWith(5, ASSET, 10, false, {});
        expect(repo.incrementWeeklyPlayCount).not.toHaveBeenCalled();
    });

    it("dwa równoległe zapisy naliczają ranking tylko, gdy atomowy znacznik wygra", async () => {
        repo.markPlayCountedToday.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        await Promise.all([
            saveProgress(1, "Kacper", { series: "Naruto", episode: "01.mp4", position: 150 }),
            saveProgress(1, "Kacper", { series: "Naruto", episode: "01.mp4", position: 160 }),
        ]);
        expect(repo.incrementWeeklyPlayCount).toHaveBeenCalledTimes(1);
        expect(repo.incrementWeeklyPlayCount).toHaveBeenCalledWith("Naruto", {});
    });

    it("completed nie znika przy seeku; wynik pochodzi z trwałego rekordu", async () => {
        repo.upsertWatchProgress.mockResolvedValue(true);
        await expect(saveProgress(1, "Kacper", { series: "Naruto", episode: "01.mp4", position: 10 })).resolves.toEqual({ ok: true, completed: true });
    });

    it("rewatch jest osobną, jawną intencją", async () => {
        await expect(resetProgressForRewatch(1, "Kacper", "Naruto", "01.mp4")).resolves.toEqual({ ok: true });
        expect(repo.resetWatchProgressForRewatch).toHaveBeenCalledWith(5, "Naruto", "01.mp4", {});
    });

    it("rewatch nieznanego odcinka zwraca unavailable, nie wyjątek", async () => {
        repo.findReadyMediaAsset.mockResolvedValueOnce(null);
        await expect(resetProgressForRewatch(1, "Kacper", "Naruto", "99.mp4"))
            .resolves.toEqual({ ok: false, code: "unavailable" });
    });

    it("rewatch odwzorowuje błąd bazy na kod server, tak jak zapis postępu", async () => {
        repo.findReadyMediaAsset.mockRejectedValueOnce(new DatabaseError("db_unavailable", 503, "brak bazy"));
        await expect(resetProgressForRewatch(1, "Kacper", "Naruto", "01.mp4"))
            .resolves.toEqual({ ok: false, code: "server" });
    });

    it("rewatch odrzuca puste klucze przed dotknięciem bazy", async () => {
        await expect(resetProgressForRewatch(1, "Kacper", "", "01.mp4"))
            .resolves.toEqual({ ok: false, code: "invalid" });
    });
});

describe("walidacja", () => {
    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 10 ** 12])("odrzuca pozycję %s", async (position) => {
        await expect(saveProgress(1, "Kacper", { series: "Naruto", episode: "01.mp4", position })).resolves.toEqual({ ok: false, code: "invalid" });
    });
});
