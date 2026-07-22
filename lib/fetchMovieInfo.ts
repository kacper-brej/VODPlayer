import { JikanAnimeData } from '@/lib/fetchMoviePopular'

export interface Episode {
    mal_id: number;
    episode: string;
    title: string;
    title_english: string | null;
    url?: string;
    images?: {
        jpg: {
            image_url: string;
        };
    };
}

const BASE_URL = process.env.NEXT_PUBLIC_MOVIE_API_URL;

export const fetchMovieInfo = async (id: number): Promise<{ details: JikanAnimeData | null, episodes: Episode[] }> => {
    try {
        if (id >= 90000) {
            const localRes = await fetch("https://vids.kacper-brej.pl/sync.php", { cache: 'no-store' });
            if (!localRes.ok) return { details: null, episodes: [] };

            const localData = await localRes.json();
            const seriesIndex = id - 90000;
            const series = localData[seriesIndex];

            if (!series) return { details: null, episodes: [] };

            let detailsMock: any = {
                title: series.title,
                synopsis: "Ten serial jest streamowany z Twojej prywatnej biblioteki na serwerze.",
                images: {
                    webp: {
                        large_image_url: 'https://images.unsplash.com/photo-1542931287-023b922fa89b?q=80&w=600&h=400&auto=format&fit=crop'
                    }
                }
            };

            try {
                const jikanRes = await fetch(`${BASE_URL}/anime?q=${encodeURIComponent(series.title)}&limit=1`);
                if (jikanRes.ok) {
                    const jikanData = await jikanRes.json();
                    if (jikanData.data && jikanData.data.length > 0) {
                        detailsMock = jikanData.data[0];
                    }
                }
            } catch (e) {
                console.error(e);
            }

            const episodesMock: Episode[] = series.episodes.map((ep: string, index: number) => ({
                mal_id: 900000 + index,
                episode: String(index + 1),
                title: ep,
                title_english: ep,
                url: `https://vids.kacper-brej.pl/uploads/${encodeURIComponent(series.title)}/${encodeURIComponent(ep)}`,
                images: {
                    jpg: {
                        image_url: detailsMock?.images?.jpg?.image_url || detailsMock?.images?.webp?.large_image_url || ''
                    }
                }
            }));

            return {
                details: detailsMock,
                episodes: episodesMock
            };
        }

        const detailRes = await fetch(`${BASE_URL}/anime/${id}`, {
            next: { revalidate: 3600 }
        });
        const detailsJson = await detailRes.json();

        const episodesRes = await fetch(`${BASE_URL}/anime/${id}/videos/episodes`, {
            next: { revalidate: 3600 }
        });
        const episodeJson = await episodesRes.json();

        return {
            details: detailsJson.data || null,
            episodes: episodeJson.data || []
        };
    } catch (err) {
        console.error("Error in fetchMovieInfo", err);
        return { details: null, episodes: [] };
    }
}