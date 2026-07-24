import { JikanAnimeData } from '@/lib/fetchMoviePopular'
import { fetchJikan } from '@/lib/jikanClient'

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

export const fetchMovieInfo = async (id: number): Promise<{ details: JikanAnimeData | null, episodes: Episode[], folderTitle?: string }> => {
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
                        large_image_url: '/fallback-cover.jpg'
                    }
                }
            };

            try {
                const jikanData = await fetchJikan(`/anime?q=${encodeURIComponent(series.title)}&limit=1`);
                if (jikanData?.data && jikanData.data.length > 0) {
                    detailsMock = jikanData.data[0];
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
                episodes: episodesMock,
                folderTitle: series.title
            };
        }

        const detailsJson = await fetchJikan(`/anime/${id}`);
        const details = detailsJson?.data || null;
        const fallbackImage = details?.images?.jpg?.image_url || details?.images?.webp?.large_image_url || '';

        const episodes: Episode[] = [];
        let page = 1;
        const MAX_PAGES = 20;

        while (page <= MAX_PAGES) {
            const episodeJson = await fetchJikan(`/anime/${id}/episodes?page=${page}`);
            const pageEpisodes = episodeJson?.data || [];

            episodes.push(...pageEpisodes.map((ep: { mal_id: number; title: string; url?: string }): Episode => ({
                mal_id: ep.mal_id,
                episode: String(ep.mal_id),
                title: ep.title || `Odcinek ${ep.mal_id}`,
                title_english: ep.title || null,
                url: ep.url,
                images: { jpg: { image_url: fallbackImage } },
            })));

            if (!episodeJson?.pagination?.has_next_page) break;
            page++;
        }

        return { details, episodes };
    } catch (err) {
        console.error("Error in fetchMovieInfo", err);
        return { details: null, episodes: [] };
    }
}