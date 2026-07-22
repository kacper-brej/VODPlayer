import {JikanAnimeData, MovieMappers} from "@/lib/fetchMoviePopular";
const BASE_URL = process.env.NEXT_PUBLIC_MOVIE_API_URL;

export const getMovieNewest = async (): Promise<MovieMappers[]> => {
    try {
        const res = await fetch(`${BASE_URL}/seasons/now?limit=20`, {
            next :{revalidate: 3600}
        });

        if(!res.ok) throw new Error('Could not find new anime ');
        const resData = await res.json();
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