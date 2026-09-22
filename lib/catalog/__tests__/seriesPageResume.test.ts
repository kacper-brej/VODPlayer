import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeasonEpisodes } from "@/components/episodes/EpisodeList";
import { dataFailure, dataSuccess } from "@/lib/core/dataResult";
import { catalogSeriesFixture } from "@/lib/catalog/__tests__/catalogSeriesFixture";

const dependencies = vi.hoisted(() => ({
    catalog: vi.fn(),
    series: vi.fn(),
    progress: vi.fn(),
    seasons: vi.fn(),
    episodes: vi.fn(),
}));

vi.mock("@/lib/catalog/catalog", () => ({
    getCatalog: dependencies.catalog,
    resolveCatalogSeries: dependencies.series,
}));
vi.mock("@/lib/progress/getProgressAction", () => ({ getProgressSnapshotAction: dependencies.progress }));
vi.mock("@/lib/catalog/tmdbVirtualSeries", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/lib/catalog/tmdbVirtualSeries")>(),
    getVirtualTmdbSeasons: dependencies.seasons,
    getVirtualTmdbEpisodesResult: dependencies.episodes,
}));
vi.mock("@/lib/player/videoAccess", () => ({ resolvePreviewSource: () => null }));
vi.mock("@/components/series/SeriesHero", () => ({ default: "series-hero" }));
vi.mock("@/components/series/SeriesMetadata", () => ({ default: "series-metadata" }));
vi.mock("@/components/episodes/EpisodeList", () => ({ default: "episode-list" }));
vi.mock("@/components/data/DataState", () => ({ DataState: "data-state", DataErrorState: "data-error" }));

const { default: SeriesPage } = await import("@/app/(app)/series/[id]/page");

const virtual = catalogSeriesFixture("tmdb:10", {
    id: 2_000_010,
    tmdbExternalId: 10,
    episodes: [],
});
const episode = (season: number, number: number) => ({
    ...catalogSeriesFixture("fixture").episodes[0],
    key: `${season}x${String(number).padStart(2, "0")}`,
    number,
    title: `Sezon ${season}, odcinek ${number}`,
});
const resume = { seriesKey: virtual.key, episodeKey: "2x03", positionSeconds: 80, durationSeconds: 1200, updatedAt: 100 };
const snapshot = { episodesBySeries: {}, resumes: [resume] };
const propsFor = (node: ReactNode, type: string): Record<string, unknown>[] => {
    if (Array.isArray(node)) return node.flatMap((child) => propsFor(child, type));
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return [
        ...(node.type === type ? [node.props] : []),
        ...propsFor(node.props.children, type),
    ];
};
const render = (season?: string, id = virtual.id) => SeriesPage({
    params: Promise.resolve({ id: String(id) }),
    searchParams: Promise.resolve(season === undefined ? {} : { season }),
});

beforeEach(() => {
    vi.clearAllMocks();
    dependencies.catalog.mockResolvedValue(dataSuccess([virtual]));
    dependencies.series.mockResolvedValue(dataSuccess(virtual));
    dependencies.progress.mockResolvedValue(dataSuccess(snapshot));
    dependencies.seasons.mockResolvedValue([1, 2].map((number) => ({
        number,
        label: `Sezon ${number}`,
        episodeCount: 3,
        year: null,
        synopsis: null,
        rating: null,
    })));
    dependencies.episodes.mockImplementation(async (_id: number, season: number) =>
        dataSuccess([episode(season, 1), episode(season, 2), episode(season, 3)]));
});

describe("wznowienie na stronie serialu", () => {
    it("otwiera sezon ostatniego odcinka TMDB i przekazuje ten sam cel do hero i listy", async () => {
        const tree = await render();
        const hero = propsFor(tree, "series-hero")[0];
        const list = propsFor(tree, "episode-list")[0];
        const seasons = list.seasons as SeasonEpisodes[];

        expect(list.initialSeason).toBe("2");
        expect(hero.resumeEpisodeKey).toBe("2x03");
        expect(hero.resumeEpisodeNumber).toBe(3);
        expect(seasons.find((season) => season.id === "2")?.resumeEpisodeKey).toBe("2x03");
        expect(seasons.find((season) => season.id === "1")?.resumeEpisodeKey).toBeNull();
        expect(dependencies.episodes).toHaveBeenCalledExactlyOnceWith(10, 2);
        expect(dependencies.progress).toHaveBeenCalledExactlyOnceWith([virtual.key]);
    });

    it("respektuje jawny wybor sezonu bez wznowienia z innego sezonu tego samego seriesKey", async () => {
        const tree = await render("1");
        const hero = propsFor(tree, "series-hero")[0];
        const list = propsFor(tree, "episode-list")[0];

        expect(list.initialSeason).toBe("1");
        expect(hero.resumeEpisodeKey).toBeNull();
        expect(hero.resumeEpisodeNumber).toBeNull();
        expect(hero.firstEpisodeKey).toBe("1x01");
        expect(hero.firstEpisodeNumber).toBe(1);
        expect((list.seasons as SeasonEpisodes[]).every((season) => season.resumeEpisodeKey === null)).toBe(true);
        expect(dependencies.episodes).toHaveBeenCalledExactlyOnceWith(10, 1);
    });

    it("nie kieruje do usunietego odcinka i zachowuje numer pierwszego dostepnego", async () => {
        dependencies.progress.mockResolvedValue(dataSuccess({ ...snapshot, resumes: [{ ...resume, episodeKey: "2x99" }] }));
        dependencies.episodes.mockResolvedValue(dataSuccess([episode(2, 4)]));

        const tree = await render();
        const hero = propsFor(tree, "series-hero")[0];
        expect(hero.resumeEpisodeKey).toBeNull();
        expect(hero.firstEpisodeKey).toBe("2x04");
        expect(hero.firstEpisodeNumber).toBe(4);
        expect((propsFor(tree, "episode-list")[0].seasons as SeasonEpisodes[])[1].resumeEpisodeKey).toBeNull();
    });

    it.each(["99", "invalid"])("pomija nieistniejacy sezon %s na rzecz sezonu wznowienia", async (season) => {
        const tree = await render(season);
        expect(propsFor(tree, "episode-list")[0].initialSeason).toBe("2");
        expect(dependencies.episodes).toHaveBeenCalledExactlyOnceWith(10, 2);
    });

    it("zachowuje pierwszy sezon i blokade logowania po bledzie autoryzacji postepu", async () => {
        dependencies.progress.mockResolvedValue(dataFailure("unauthorized"));

        const tree = await render();
        const list = propsFor(tree, "episode-list")[0];
        expect(list.initialSeason).toBe("1");
        expect(list.authRequired).toBe(true);
        expect(propsFor(tree, "series-hero")[0].resumeEpisodeKey).toBeNull();
    });

    it("po bledzie odcinkow pokazuje blad aktywnego sezonu bez odtwarzania obcego wznowienia", async () => {
        dependencies.episodes.mockResolvedValue(dataFailure("server"));

        const tree = await render();
        const list = propsFor(tree, "episode-list")[0];
        const active = (list.seasons as SeasonEpisodes[]).find((season) => season.id === list.initialSeason);
        expect(active?.loadError).toBe("server");
        expect(active?.resumeEpisodeKey).toBeNull();
        expect(propsFor(tree, "series-hero")[0].resumeEpisodeKey).toBeNull();
        expect(dependencies.episodes).toHaveBeenCalledTimes(1);
    });

    it("rozpoczyna pobieranie sezonow zanim odczyt postepu sie zakonczy", async () => {
        let resolveProgress!: (value: ReturnType<typeof dataSuccess<typeof snapshot>>) => void;
        dependencies.progress.mockReturnValue(new Promise((resolve) => { resolveProgress = resolve; }));
        const pending = render();
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(dependencies.seasons).toHaveBeenCalledExactlyOnceWith(10);
        expect(dependencies.episodes).not.toHaveBeenCalled();
        resolveProgress(dataSuccess(snapshot));
        await pending;
        expect(dependencies.episodes).toHaveBeenCalledExactlyOnceWith(10, 2);
    });

    it("zachowuje sezon lokalnej strony i rozroznia identyczne nazwy plikow miedzy sezonami", async () => {
        const first = catalogSeriesFixture("local-s1", { id: 100, groupId: 7, seasonNumber: 1 });
        const second = catalogSeriesFixture("local-s2", { id: 101, groupId: 7, seasonNumber: 2 });
        dependencies.catalog.mockResolvedValue(dataSuccess([first, second]));
        dependencies.series.mockResolvedValue(dataSuccess(first));
        dependencies.progress.mockResolvedValue(dataSuccess({
            episodesBySeries: {},
            resumes: [{ ...resume, seriesKey: second.key, episodeKey: "01.mp4" }],
        }));

        const tree = await render(undefined, first.id);
        const list = propsFor(tree, "episode-list")[0];
        expect(list.initialSeason).toBe("1");
        expect(propsFor(tree, "series-hero")[0].resumeEpisodeKey).toBeNull();
        expect((list.seasons as SeasonEpisodes[])[1].resumeEpisodeKey).toBe("01.mp4");
        expect(dependencies.seasons).not.toHaveBeenCalled();
        expect(dependencies.episodes).not.toHaveBeenCalled();
    });
});
