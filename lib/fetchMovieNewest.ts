import {JikanAnimeData, MovieMappers} from "@/lib/fetchMoviePopular";
import { fetchJikan } from "@/lib/jikanClient";

export const getMovieNewest = async (): Promise<MovieMappers[]> => {
    try {
        const resData = await fetchJikan(`/seasons/now?limit=20`);

        if(!resData) throw new Error('Could not find new anime ');
        return resData.data
            .sort((a:JikanAnimeData, b:JikanAnimeData) => (b.score || 0) - (a.score || 0))
            .map((movie:JikanAnimeData) => ({
                id: movie.mal_id,
                title: movie.title,
                coverImage: movie.images.webp.large_image_url,
                rating: movie.rating ? movie.rating.split(' ')[0] : 'NR',
                year: movie.year || new Date().getFullYear(),
            }));
    }catch (error) {
        console.log("fetchMovieNewest error:", error);
        return [] as MovieMappers[];
    }

}