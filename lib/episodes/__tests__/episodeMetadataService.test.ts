import { beforeEach, describe, expect, it, vi } from "vitest";

const hasReadyMediaAsset = vi.fn();
const upsertEpisodeMetadata = vi.fn();
const listReadyEpisodesForBackfill = vi.fn();

vi.mock("@/lib/episodes/episodeMetadataRepository", () => ({
    hasReadyMediaAsset,
    upsertEpisodeMetadata,
    listReadyEpisodesForBackfill,
}));

const {
    listEpisodeBackfillSeries,
    parseEpisodeMetadataPatch,
    saveEpisodeMetadata,
} = await import("../episodeMetadataService");

beforeEach(() => vi.clearAllMocks());

describe("parseEpisodeMetadataPatch", () => {
    it("normalizuje tekst i zachowuje tylko jawnie przekazane pola", () => {
        expect(parseEpisodeMetadataPatch({
            series: "  Test  ",
            episode: "01.mp4",
            title: "  Tytuł  ",
        })).toEqual({
            seriesKey: "Test",
            episodeKey: "01.mp4",
            title: "Tytuł",
        });
    });

    it("wymaga źródła dla niepustej miniatury", () => {
        expect(parseEpisodeMetadataPatch({
            series: "Test",
            episode: "01.mp4",
            thumbnailPath: "/still.jpg",
        })).toBeNull();
    });

    it("odrzuca puste żądanie i niebezpieczne klucze", () => {
        expect(parseEpisodeMetadataPatch({ series: "Test", episode: "01.mp4" })).toBeNull();
        expect(parseEpisodeMetadataPatch({ series: "../Test", episode: "01.mp4", title: "X" })).toBeNull();
        expect(parseEpisodeMetadataPatch({ series: "Test", episode: "../01.mp4", title: "X" })).toBeNull();
    });
});

describe("saveEpisodeMetadata", () => {
    it("nie zapisuje metadanych, jeśli nie istnieje gotowy asset HLS", async () => {
        hasReadyMediaAsset.mockResolvedValue(false);

        await expect(saveEpisodeMetadata({
            series: "Test",
            episode: "01.mp4",
            title: "Tytuł",
        })).resolves.toEqual({ ok: false, code: "not_found" });
        expect(upsertEpisodeMetadata).not.toHaveBeenCalled();
    });

    it("zapisuje poprawny patch gotowego odcinka", async () => {
        hasReadyMediaAsset.mockResolvedValue(true);
        upsertEpisodeMetadata.mockResolvedValue({
            episodeKey: "01.mp4",
            title: "Tytuł",
            synopsis: null,
            durationSeconds: 1200,
            thumbnailPath: "/still.jpg",
            thumbnailSource: "tmdb",
        });

        await expect(saveEpisodeMetadata({
            series: "Test",
            episode: "01.mp4",
            title: "Tytuł",
            thumbnailPath: "/still.jpg",
            thumbnailSource: "tmdb",
        })).resolves.toMatchObject({ ok: true });
        expect(upsertEpisodeMetadata).toHaveBeenCalledWith({
            seriesKey: "Test",
            episodeKey: "01.mp4",
            title: "Tytuł",
            thumbnailPath: "/still.jpg",
            thumbnailSource: "tmdb",
        });
    });
});

describe("odczyt i backfill", () => {
    it("grupuje wszystkie gotowe odcinki niezależnie od publikacji serii", async () => {
        listReadyEpisodesForBackfill.mockResolvedValue([
            { series_key: "Test", episode_key: "01.mp4", season_number: 2, title: null, synopsis: null, thumbnail_path: null, thumbnail_source: null },
            { series_key: "Test", episode_key: "02.mp4", season_number: 2, title: "Drugi", synopsis: "Opis", thumbnail_path: "/local.jpg", thumbnail_source: "local" },
        ]);

        await expect(listEpisodeBackfillSeries()).resolves.toEqual([{
            key: "Test",
            title: "Test",
            seasonNumber: 2,
            episodes: [
                { key: "01.mp4", number: 1, title: null, synopsis: null, thumbnailPath: null, thumbnailSource: null },
                { key: "02.mp4", number: 2, title: "Drugi", synopsis: "Opis", thumbnailPath: "/local.jpg", thumbnailSource: "local" },
            ],
        }]);
    });
});
