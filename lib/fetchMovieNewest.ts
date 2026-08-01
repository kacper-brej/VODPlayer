import { MovieMappers } from "@/lib/fetchMoviePopular";
import { fetchJikanResult } from "@/lib/jikanClient";
import { validateJikanAnimeListResponse } from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/dataResult";

export const getMovieNewest = async (): Promise<DataResult<MovieMappers[]>> => {
    try {
        const response = await fetchJikanResult(
            `/seasons/now?limit=20`,
            undefined,
            (value) => validateJikanAnimeListResponse(value).ok,
        );

        if (response.kind === "error") return response;

        const result = validateJikanAnimeListResponse(response.data);
        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        const movies = result.data.data
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map((movie) => ({
                id: movie.mal_id,
                title: movie.title,
                coverImage: movie.images.webp.large_image_url,
                rating: movie.rating ? movie.rating.split(' ')[0] : 'NR',
                year: movie.year || new Date().getFullYear(),
            }));

        return movies.length === 0
            ? dataEmpty(movies)
            : dataSuccess(movies);
    }catch (error) {
        console.error("getMovieNewest failed:", error);
        return dataFailure("server");
    }

}
