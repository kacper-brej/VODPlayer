import { MovieMappers } from "@/lib/fetchMoviePopular";

interface LocalSyncResponse {
    title: string;
    episodes: string[];
}

export type LocalMovieMapper = MovieMappers & { localEpisodes: string[] };

const BASE_URL = process.env.NEXT_PUBLIC_MOVIE_API_URL;

export const getLocalUploads = async (): Promise<LocalMovieMapper[]> => {
    try {
        const res = await fetch("https://vids.kacper-brej.pl/sync.php", { cache: 'no-store' });

        if (!res.ok) return [];

        const data: LocalSyncResponse[] = await res.json();

        return await Promise.all(data.map(async (item: LocalSyncResponse, index: number): Promise<LocalMovieMapper> => {
            let coverUrl = "";
            let score = "Local";
            let releaseYear = new Date().getFullYear();

            try {
                const jikanRes = await fetch(`${BASE_URL}/anime?q=${encodeURIComponent(item.title)}&limit=1`);

                if (jikanRes.ok) {
                    const jikanData = await jikanRes.json();
                    if (jikanData.data && jikanData.data.length > 0) {
                        const anime = jikanData.data[0];
                        coverUrl = anime.images.webp.large_image_url;
                        score = anime.score ? anime.score.toString() : "Local";

                        if (anime.year) {
                            releaseYear = anime.year;
                        }
                    }
                }
            } catch (error) {
                console.error(error);
            }

            return {
                id: 90000 + index,
                mal_id: 90000 + index,
                title: item.title,
                coverImage: coverUrl || 'https://images.unsplash.com/photo-1542931287-023b922fa89b?q=80&w=600&h=400&auto=format&fit=crop',
                rating: score,
                year: releaseYear,
                localEpisodes: item.episodes
            } as unknown as LocalMovieMapper;
        }));

    } catch (error) {
        console.error(error);
        return [];
    }
}