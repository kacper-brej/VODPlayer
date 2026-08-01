import {
    validateJikanAnimeListResponse,
    validateJikanAnimeResponse,
    validateJikanEpisodesResponse,
    type JikanAnime as JikanAnimeData,
} from '@/lib/contracts'
import { fetchJikanResult } from '@/lib/jikanClient'
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from '@/lib/dataResult'

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

interface LocalMovieDetails {
    title: string;
    synopsis: string;
    images: {
        jpg: { image_url: string };
        webp: { large_image_url: string };
    };
}

interface LocalSeries {
    title: string;
    episodes: string[];
}

type MovieInfo = {
    details: JikanAnimeData | LocalMovieDetails | null;
    episodes: Episode[];
    folderTitle?: string;
};

const isLocalSeriesList = (value: unknown): value is LocalSeries[] =>
    Array.isArray(value)
    && value.every((entry) =>
        typeof entry === "object"
        && entry !== null
        && "title" in entry
        && typeof entry.title === "string"
        && "episodes" in entry
        && Array.isArray(entry.episodes)
        && entry.episodes.every((episode: unknown) => typeof episode === "string"),
    );

export const fetchMovieInfo = async (id: number): Promise<DataResult<MovieInfo>> => {
    try {
        if (id >= 90000) {
            const localRes = await fetch("https://vids.kacper-brej.pl/sync.php", { cache: 'no-store' });
            if (!localRes.ok) return failureFromStatus(localRes.status);

            const payload: unknown = await localRes.json();
            if (!isLocalSeriesList(payload)) return dataFailure("invalid_response");

            const seriesIndex = id - 90000;
            const series = payload[seriesIndex];

            if (!series) return dataEmpty({ details: null, episodes: [] });

            let details: JikanAnimeData | LocalMovieDetails = {
                title: series.title,
                synopsis: "Ten serial jest streamowany z Twojej prywatnej biblioteki na serwerze.",
                images: {
                    jpg: {
                        image_url: '/fallback-cover.jpg'
                    },
                    webp: {
                        large_image_url: '/fallback-cover.jpg'
                    }
                }
            };

            try {
                const response = await fetchJikanResult(
                    `/anime?q=${encodeURIComponent(series.title)}&limit=1`,
                    undefined,
                    (value) => validateJikanAnimeListResponse(value).ok,
                );
                if (response.kind !== "error") {
                    const result = validateJikanAnimeListResponse(response.data);
                    if (result.ok && result.data.data[0]) {
                        details = result.data.data[0];
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
                        image_url: details.images.jpg.image_url || details.images.webp.large_image_url
                    }
                }
            }));

            return dataSuccess({
                details,
                episodes: episodesMock,
                folderTitle: series.title
            });
        }

        const detailsResponse = await fetchJikanResult(
            `/anime/${id}`,
            undefined,
            (value) => validateJikanAnimeResponse(value).ok,
        );
        if (detailsResponse.kind === "error") return detailsResponse;

        const detailsResult = validateJikanAnimeResponse(detailsResponse.data);
        if (!detailsResult.ok) return dataFailure("invalid_response");

        const details = detailsResult.data.data;
        const fallbackImage = details.images.jpg.image_url || details.images.webp.large_image_url;
        const episodes: Episode[] = [];
        let page = 1;
        const MAX_PAGES = 20;

        while (page <= MAX_PAGES) {
            const episodeResponse = await fetchJikanResult(
                `/anime/${id}/episodes?page=${page}`,
                undefined,
                (value) => validateJikanEpisodesResponse(value).ok,
            );
            if (episodeResponse.kind === "error") return episodeResponse;

            const episodeResult = validateJikanEpisodesResponse(episodeResponse.data);
            if (!episodeResult.ok) return dataFailure("invalid_response");

            episodes.push(...episodeResult.data.data.map((ep): Episode => ({
                mal_id: ep.mal_id,
                episode: String(ep.mal_id),
                title: ep.title || `Odcinek ${ep.mal_id}`,
                title_english: ep.title || null,
                url: ep.url,
                images: { jpg: { image_url: fallbackImage } },
            })));

            if (!episodeResult.data.pagination.has_next_page) break;
            page++;
        }

        const data = { details, episodes };
        return details || episodes.length > 0
            ? dataSuccess(data)
            : dataEmpty(data);
    } catch (err) {
        console.error("Error in fetchMovieInfo", err);
        return dataFailure("network");
    }
}
