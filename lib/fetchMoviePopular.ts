import { fetchJikan } from "@/lib/jikanClient";

export interface MovieMappers {
    id:number,
    title:string,
    coverImage:string,
    rating:string,
    year:number | undefined;
}

export interface JikanAnimeData {
    mal_id:number;
    title_english: string | null;
    title: string;
    synopsis: string;
    genres: {
        mal_id: number;
        name: string;
    }
    images: {
        webp: {
            large_image_url: string;
        };
    };
    rating: string | null;
    year: number | null;
    score: number | null;
}

export const getTopMovie = async (): Promise<MovieMappers[]> => {

    try {
        const data = await fetchJikan(`/top/anime?limit=20`);

        if(!data) throw new Error(`Could not find top-movie`);

        return data.data.map((movie: JikanAnimeData) => ({
            id: movie.mal_id,
            title: movie.title_english || movie.title,
            coverImage: movie.images.webp.large_image_url,
            rating: movie.rating ? movie.rating.split(' ')[0] : "NR",
            year: movie.year,
        }));
    } catch (error) {
        console.log("fetchMovie error:", error);
        return [] as MovieMappers[];
    }
}