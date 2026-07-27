"use server";
import { FALLBACK_COVER, getCatalogSeriesById, isLocalSeriesId } from "@/lib/catalog";
import { getSeriesProgressAction } from "@/lib/getProgressAction";
import { progressPercent, isWatched } from "@/lib/watchProgress";
import { fetchJikan } from "@/lib/jikanClient";
import { lookupJikanMetadata, persistSeriesMetadata, invalidateCatalogCache } from "@/lib/seriesMetadata";

export interface SeriesDetailsEpisode {
    key: string;
    number: number;
    title: string;
    url: string | null;
    thumbnail: string;
    positionSeconds: number;
    percent: number;
    watched: boolean;
}

export interface SeriesDetails {
    id: number;
    seriesKey: string | null;
    title: string;
    synopsis: string;
    bannerImage: string;
    year: number | null;
    rating: string | null;
    isLocal: boolean;
    resumeEpisodeKey: string | null;
    episodes: SeriesDetailsEpisode[];
}

const MAX_JIKAN_EPISODE_PAGES = 3;

const localDetails = async (id: number): Promise<SeriesDetails | null> => {
    const series = await getCatalogSeriesById(id);

    if (!series) return null;

    const { episodes: progress, resume } = await getSeriesProgressAction(series.key);

    let synopsis = series.synopsis;
    let bannerImage = series.bannerImage || series.coverImage;
    let year = series.year;
    let rating = series.rating;

    if (!series.hasMetadata || !synopsis) {
        const metadata = await lookupJikanMetadata(series.title);

        if (metadata) {
            synopsis = metadata.synopsis ?? synopsis;
            bannerImage = metadata.bannerImage ?? bannerImage;
            year = metadata.year ?? year;
            rating = metadata.rating ?? rating;

            const saved = await persistSeriesMetadata(series.title, metadata);
            if (saved) invalidateCatalogCache();
        }
    }

    return {
        id: series.id,
        seriesKey: series.key,
        title: series.title,
        synopsis: synopsis || "Ten serial jest streamowany z Twojej prywatnej biblioteki.",
        bannerImage: bannerImage || FALLBACK_COVER,
        year,
        rating,
        isLocal: true,
        resumeEpisodeKey: resume?.episodeKey ?? null,
        episodes: series.episodes.map((episode) => {
            const entry = progress[episode.key];
            const positionSeconds = entry?.positionSeconds ?? 0;

            return {
                key: episode.key,
                number: episode.number,
                title: `Odcinek ${episode.number}`,
                url: episode.url,
                thumbnail: bannerImage || FALLBACK_COVER,
                positionSeconds,
                percent: progressPercent(positionSeconds, entry?.durationSeconds),
                watched: entry?.completed ?? isWatched(positionSeconds, entry?.durationSeconds),
            };
        }),
    };
};

const remoteDetails = async (id: number): Promise<SeriesDetails | null> => {
    const detailsJson = await fetchJikan(`/anime/${id}`);
    const details = detailsJson?.data;

    if (!details) return null;

    const poster = details.images?.webp?.large_image_url ?? details.images?.jpg?.image_url ?? FALLBACK_COVER;
    const episodes: SeriesDetailsEpisode[] = [];

    for (let page = 1; page <= MAX_JIKAN_EPISODE_PAGES; page++) {
        const episodeJson = await fetchJikan(`/anime/${id}/episodes?page=${page}`);
        const pageEpisodes = episodeJson?.data ?? [];

        pageEpisodes.forEach((episode: { mal_id: number; title?: string }, index: number) => {
            episodes.push({
                key: String(episode.mal_id),
                number: episodes.length + index + 1,
                title: episode.title || `Odcinek ${episode.mal_id}`,
                url: null,
                thumbnail: poster,
                positionSeconds: 0,
                percent: 0,
                watched: false,
            });
        });

        if (!episodeJson?.pagination?.has_next_page) break;
    }

    return {
        id,
        seriesKey: null,
        title: details.title_english || details.title,
        synopsis: details.synopsis || "Brak opisu.",
        bannerImage: poster,
        year: details.year ?? null,
        rating: details.score ? String(details.score) : null,
        isLocal: false,
        resumeEpisodeKey: null,
        episodes,
    };
};

const getSeriesDetailsAction = async (id: number): Promise<SeriesDetails | null> => {
    if (!Number.isFinite(id)) return null;

    try {
        return isLocalSeriesId(id) ? await localDetails(id) : await remoteDetails(id);
    } catch (error) {
        console.error("getSeriesDetailsAction failed", error);
        return null;
    }
};

export default getSeriesDetailsAction;
