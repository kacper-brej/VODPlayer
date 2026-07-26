import { MovieMappers } from "@/lib/fetchMoviePopular";
import { fetchJikan } from "@/lib/jikanClient";

interface LocalSyncResponse {
    title: string;
    episodes: string[];
}

export type LocalMovieMapper = MovieMappers & { localEpisodes: string[]; previewVideoUrl?: string };
export type LocalSeriesRaw = { id: number; title: string; localEpisodes: string[] };

type CoverCacheEntry = { coverImage: string; rating: string; year: number };

const UPLOAD_SECRET = process.env.UPLOAD_SECRET ?? "";
const CACHE_ENDPOINT = "https://vids.kacper-brej.pl/cache-covers.php";

let coverCache: Record<string, CoverCacheEntry> | null = null;

const loadCoverCache = async (): Promise<Record<string, CoverCacheEntry>> => {
    if (coverCache) return coverCache;

    try {
        const res = await fetch(`${CACHE_ENDPOINT}?key=${encodeURIComponent(UPLOAD_SECRET)}`, { cache: 'no-store' });
        coverCache = res.ok ? await res.json() : {};
    } catch {
        coverCache = {};
    }

    return coverCache!;
};

const saveCoverEntry = async (title: string, entry: CoverCacheEntry) => {
    try {
        await fetch(CACHE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: UPLOAD_SECRET, title, ...entry }),
        });
    } catch (error) {
        console.error(error);
    }
};

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
        const covers = await loadCoverCache();

        return await Promise.all(data.map(async (item: LocalSyncResponse, index: number): Promise<LocalMovieMapper> => {
            let coverUrl = covers[item.title]?.coverImage || "";
            let score = covers[item.title]?.rating || "Local";
            let releaseYear = covers[item.title]?.year || new Date().getFullYear();

            if (!covers[item.title]) {
                try {
                    const jikanData = await fetchJikan(`/anime?q=${encodeURIComponent(item.title)}&limit=1`);

                    if (jikanData?.data && jikanData.data.length > 0) {
                        const anime = jikanData.data[0];
                        coverUrl = anime.images.webp.large_image_url;
                        score = anime.score ? anime.score.toString() : "Local";
                        releaseYear = anime.year || releaseYear;

                        const entry = { coverImage: coverUrl, rating: score, year: releaseYear };
                        covers[item.title] = entry;
                        await saveCoverEntry(item.title, entry);
                    }
                } catch (error) {
                    console.error(error);
                }
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