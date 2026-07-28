"use server";
import { FALLBACK_COVER, resolveCatalogSeries } from "@/lib/catalog";
import { getSeriesProgressAction } from "@/lib/getProgressAction";
import { progressPercent, isWatched } from "@/lib/watchProgress";
import { fetchJikanResult } from "@/lib/jikanClient";
import { lookupJikanMetadata, persistSeriesMetadata, invalidateCatalogCache } from "@/lib/seriesMetadata";
import {
    validateJikanAnimeResponse,
    validateJikanEpisodesResponse,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/dataResult";

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

const localDetails = async (id: number): Promise<DataResult<SeriesDetails | null>> => {
    const seriesResult = await resolveCatalogSeries(String(id));
    if (seriesResult.kind === "error") return seriesResult;

    if (!seriesResult.data) return dataEmpty(null);

    const series = seriesResult.data;
    const progressResult = await getSeriesProgressAction(series.key);
    if (progressResult.kind === "error") return progressResult;

    const { episodes: progress, resume } = progressResult.data;

    let synopsis = series.synopsis;
    let bannerImage = series.bannerImage || series.coverImage;
    let year = series.year;
    let rating = series.rating;

    if (!series.hasMetadata || !synopsis) {
        const metadataResult = await lookupJikanMetadata(series.title);
        if (metadataResult.kind === "error") return metadataResult;

        if (metadataResult.data) {
            const metadata = metadataResult.data;
            synopsis = metadata.synopsis ?? synopsis;
            bannerImage = metadata.backdropImage ?? metadata.coverImage ?? bannerImage;
            year = metadata.year ?? year;
            rating = metadata.rating ?? rating;

            const saved = await persistSeriesMetadata(series.title, metadata);
            if (saved) invalidateCatalogCache();
        }
    }

    return dataSuccess({
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
    });
};

const remoteDetails = async (id: number): Promise<DataResult<SeriesDetails | null>> => {
    const detailsResponse = await fetchJikanResult(`/anime/${id}`);
    if (detailsResponse.kind === "error") return detailsResponse;

    const detailsResult = validateJikanAnimeResponse(detailsResponse.data);
    if (!detailsResult.ok) return dataFailure("invalid_response");

    const details = detailsResult.data.data;
    const poster = details.images.webp.large_image_url || details.images.jpg.image_url || FALLBACK_COVER;
    const episodes: SeriesDetailsEpisode[] = [];

    for (let page = 1; page <= MAX_JIKAN_EPISODE_PAGES; page++) {
        const episodeResponse = await fetchJikanResult(`/anime/${id}/episodes?page=${page}`);
        if (episodeResponse.kind === "error") return episodeResponse;

        const episodeResult = validateJikanEpisodesResponse(episodeResponse.data);
        if (!episodeResult.ok) return dataFailure("invalid_response");

        const offset = episodes.length;
        episodeResult.data.data.forEach((episode, index) => {
            episodes.push({
                key: String(episode.mal_id),
                number: offset + index + 1,
                title: episode.title || `Odcinek ${episode.mal_id}`,
                url: null,
                thumbnail: poster,
                positionSeconds: 0,
                percent: 0,
                watched: false,
            });
        });

        if (!episodeResult.data.pagination.has_next_page) break;
    }

    return dataSuccess({
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
    });
};

const getSeriesDetailsAction = async (id: number): Promise<DataResult<SeriesDetails | null>> => {
    if (!Number.isFinite(id)) return dataEmpty(null);

    try {
        const localResult = await localDetails(id);

        if (localResult.kind === "error" || localResult.data) {
            return localResult;
        }

        return await remoteDetails(id);
    } catch (error) {
        console.error("getSeriesDetailsAction failed", error);
        return dataFailure("server");
    }
};

export default getSeriesDetailsAction;
