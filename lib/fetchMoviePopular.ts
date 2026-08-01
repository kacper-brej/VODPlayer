import { fetchJikanResult } from "@/lib/jikanClient";
import { validateJikanAnimeListResponse } from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/dataResult";

export interface MovieMappers {
    id:number,
    title:string,
    coverImage:string,
    rating:string,
    year:number | undefined;
}

export const getTopMovie = async (): Promise<DataResult<MovieMappers[]>> => {

    try {
        const response = await fetchJikanResult(
            `/top/anime?limit=20`,
            undefined,
            (value) => validateJikanAnimeListResponse(value).ok,
        );

        if (response.kind === "error") return response;

        const result = validateJikanAnimeListResponse(response.data);
        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        const movies = result.data.data.map((movie) => ({
            id: movie.mal_id,
            title: movie.title_english || movie.title,
            coverImage: movie.images.webp.large_image_url,
            rating: movie.rating ? movie.rating.split(' ')[0] : "NR",
            year: movie.year ?? undefined,
        }));

        return movies.length === 0
            ? dataEmpty(movies)
            : dataSuccess(movies);
    } catch (error) {
        console.error("getTopMovie failed:", error);
        return dataFailure("server");
    }
}
