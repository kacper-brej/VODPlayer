import { MovieMappers } from "@/lib/fetchMoviePopular";
import { fetchJikan } from "@/lib/jikanClient";

interface LocalSyncResponse {
    title: string;
    episodes: string[];
}

export type LocalMovieMapper = MovieMappers & { localEpisodes: string[]; previewVideoUrl?: string };
export type LocalSeriesRaw = { id: number; title: string; localEpisodes: string[] };

export const getLocalSeriesRaw = async (): Promise<LocalSeriesRaw[]> => {
    try {
        const res = await fetch("https://vids.kacper-brej.pl/sync.php", { cache: 'no-store' });

        if (!res.ok) return [];

        const data: LocalSyncResponse[] = await res.json();

        return data.map((item, index) => ({
            id: 90000 + index,
            title: item.title,
            localEpisodes: item.episodes,
        }));
    } catch (error) {
        console.error(error);
        return [];
    }
}

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
                const jikanData = await fetchJikan(`/anime?q=${encodeURIComponent(item.title)}&limit=1`);

                if (jikanData?.data && jikanData.data.length > 0) {
                    const anime = jikanData.data[0];
                    coverUrl = anime.images.webp.large_image_url;
                    score = anime.score ? anime.score.toString() : "Local";

                    if (anime.year) {
                        releaseYear = anime.year;
                    }
                }
            } catch (error) {
                console.error(error);
            }

            return {
                id: 90000 + index,
                mal_id: 90000 + index,
                title: item.title,
                coverImage: coverUrl || '/fallback-cover.jpg',
                rating: score,
                year: releaseYear,
                localEpisodes: item.episodes,
                previewVideoUrl: item.episodes[0]
                    ? `https://vids.kacper-brej.pl/uploads/${encodeURIComponent(item.title)}/${encodeURIComponent(item.episodes[0])}`
                    : undefined,
            } as unknown as LocalMovieMapper;
        }));

    } catch (error) {
        console.error(error);
        return [];
    }
}