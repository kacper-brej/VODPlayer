import type { MovieMappers } from "@/lib/fetchMoviePopular";
import { getCatalog } from "@/lib/catalog";
import {
    dataEmpty,
    dataSuccess,
    type DataResult,
} from "@/lib/dataResult";

export type LocalMovieMapper = MovieMappers & {
    localEpisodes: string[];
};

export type LocalSeriesRaw = {
    id: number;
    title: string;
    localEpisodes: string[];
};

export const getLocalSeriesRaw = async (): Promise<DataResult<LocalSeriesRaw[]>> => {
    const result = await getCatalog();
    if (result.kind === "error") return result;

    const series = result.data.map((item) => ({
        id: item.id,
        title: item.title,
        localEpisodes: item.episodes.map((episode) => episode.key),
    }));

    return series.length === 0
        ? dataEmpty(series)
        : dataSuccess(series);
};

export const getLocalUploads = async (): Promise<DataResult<LocalMovieMapper[]>> => {
    const result = await getCatalog();
    if (result.kind === "error") return result;

    const movies = result.data.map((item) => ({
        id: item.id,
        title: item.title,
        coverImage: item.coverImage,
        rating: item.rating,
        year: item.year ?? undefined,
        localEpisodes: item.episodes.map((episode) => episode.key),
    }));

    return movies.length === 0
        ? dataEmpty(movies)
        : dataSuccess(movies);
};
