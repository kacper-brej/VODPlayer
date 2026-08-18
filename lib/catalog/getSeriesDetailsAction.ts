"use server";
import { resolveCatalogSeries } from "@/lib/catalog/catalog";
import { isVirtualTmdbKey } from "@/lib/catalog/tmdbVirtualSeries";
import { getSeriesProgressAction } from "@/lib/progress/getProgressAction";
import { progressPercent, isWatched } from "@/lib/progress/watchProgress";
import { fetchJikanRaw } from "@/lib/metadata/providers/jikan";
import { resolveSeriesIdentity } from "@/lib/metadata/registry";
import { persistSeriesIdentity } from "@/lib/metadata/persistIdentity";
import { invalidateCatalogCache } from "@/lib/catalog/seriesMetadata";
import {
    validateJikanAnimeResponse,
    validateJikanEpisodesResponse,
} from "@/lib/core/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";
import { getSessionUser } from "@/lib/auth/session";

export interface SeriesDetailsEpisode {
    key: string;
    number: number;
    title: string;
    url: string | null;
    thumbnail: string | null;
    positionSeconds: number;
    percent: number;
    watched: boolean;
}

export interface SeriesDetails {
    id: number;
    seriesKey: string | null;
    title: string;
    synopsis: string;
    bannerImage: string | null;
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
    let bannerImage = series.bannerImage;
    let year = series.year;
    let rating = series.rating;

    if (!isVirtualTmdbKey(series.key) && (!series.hasMetadata || !synopsis)) {
        const identityResult = await resolveSeriesIdentity(series.title);
        if (identityResult.kind === "error") return identityResult;

        if (identityResult.data.kind === "matched") {
            const { providerId, externalId, series: providerSeries, artwork } = identityResult.data;

            synopsis = providerSeries.synopsis ?? synopsis;
            bannerImage = artwork.find((entry) => entry.kind === "backdrop")?.url
                ?? bannerImage;
            year = providerSeries.year ?? year;
            rating = providerSeries.score !== null ? String(providerSeries.score) : rating;

            const saved = await persistSeriesIdentity(series.key, providerId, externalId, providerSeries, artwork, "auto");
            if (saved) invalidateCatalogCache();
        }
    }

    return dataSuccess({
        id: series.id,
        seriesKey: series.key,
        title: series.title,
        synopsis: synopsis || "Ten serial jest streamowany z Twojej prywatnej biblioteki.",
        bannerImage,
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
                thumbnail: episode.thumbnail,
                positionSeconds,
                percent: progressPercent(positionSeconds, entry?.durationSeconds),
                watched: entry?.completed ?? isWatched(positionSeconds, entry?.durationSeconds),
            };
        }),
    });
};

const remoteDetails = async (id: number): Promise<DataResult<SeriesDetails | null>> => {
    const detailsResponse = await fetchJikanRaw(
        `/anime/${id}`,
        undefined,
        (value) => validateJikanAnimeResponse(value).ok,
    );
    if (detailsResponse.kind === "error") return detailsResponse;

    const detailsResult = validateJikanAnimeResponse(detailsResponse.data);
    if (!detailsResult.ok) return dataFailure("invalid_response");

    const details = detailsResult.data.data;
    const episodes: SeriesDetailsEpisode[] = [];

    for (let page = 1; page <= MAX_JIKAN_EPISODE_PAGES; page++) {
        const episodeResponse = await fetchJikanRaw(
            `/anime/${id}/episodes?page=${page}`,
            undefined,
            (value) => validateJikanEpisodesResponse(value).ok,
        );
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
                thumbnail: null,
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
        bannerImage: null,
        year: details.year ?? null,
        rating: details.score ? String(details.score) : null,
        isLocal: false,
        resumeEpisodeKey: null,
        episodes,
    });
};

const getSeriesDetailsAction = async (id: number): Promise<DataResult<SeriesDetails | null>> => {
    if (!await getSessionUser()) return dataFailure("unauthorized", 401);
    if (!Number.isSafeInteger(id) || id <= 0) return dataEmpty(null);

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
