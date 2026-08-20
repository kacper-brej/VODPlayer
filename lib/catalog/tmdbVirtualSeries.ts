import "server-only";
import { cache } from "react";
import { getDemoAsset, type DemoAsset } from "@/lib/access/demoAsset";
import type { CatalogEpisode, CatalogSeries } from "@/lib/catalog/catalog";
import type { CatalogGenre, TmdbMovieListItem, TmdbTvListItem } from "@/lib/core/contracts";
import { dataEmpty, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { getTmdbImageBaseUrl } from "@/lib/metadata/tmdbConfig";
import { getTmdbMovie } from "@/lib/metadata/tmdbMovies";
import {
    getTmdbSeasonEpisodes,
    getTmdbSeasonSummaries,
    tmdbProvider,
} from "@/lib/metadata/providers/tmdb";
import { signedManifestUrl } from "@/lib/player/videoAccess";

export const TMDB_VIRTUAL_ID_OFFSET = 2_000_000;
export const TMDB_VIRTUAL_ID_LIMIT = 3_000_000;
export const TMDB_VIRTUAL_MOVIE_ID_OFFSET = 3_000_000;
export const TMDB_VIRTUAL_MOVIE_ID_LIMIT = 4_000_000;

const VIRTUAL_KEY_PREFIX = "tmdb:";
const VIRTUAL_MOVIE_KEY_PREFIX = "tmdb:movie:";
const VIRTUAL_KEY_PATTERN = /^tmdb:(\d+)$/;
const VIRTUAL_MOVIE_KEY_PATTERN = /^tmdb:movie:(\d+)$/;
const FALLBACK_SYNOPSIS = "Ten tytuł pochodzi z katalogu TMDB.";

export type TmdbVirtualKind = "tv" | "movie";

export interface TmdbVirtualRef {
    kind: TmdbVirtualKind;
    id: number;
}

export const virtualTmdbKey = (tmdbId: number): string => `${VIRTUAL_KEY_PREFIX}${tmdbId}`;

export const virtualTmdbMovieKey = (tmdbId: number): string => `${VIRTUAL_MOVIE_KEY_PREFIX}${tmdbId}`;

export const virtualTmdbSeriesId = (tmdbId: number): number => TMDB_VIRTUAL_ID_OFFSET + tmdbId;

export const virtualTmdbMovieId = (tmdbId: number): number => TMDB_VIRTUAL_MOVIE_ID_OFFSET + tmdbId;

export const isVirtualTmdbTvKey = (key: string): boolean => VIRTUAL_KEY_PATTERN.test(key);

export const isVirtualTmdbMovieKey = (key: string): boolean => VIRTUAL_MOVIE_KEY_PATTERN.test(key);

export const isVirtualTmdbKey = (key: string): boolean =>
    isVirtualTmdbTvKey(key) || isVirtualTmdbMovieKey(key);

const isUsableTmdbId = (value: number): boolean =>
    Number.isSafeInteger(value) && value > 0 && value < TMDB_VIRTUAL_ID_LIMIT - TMDB_VIRTUAL_ID_OFFSET;

export const parseVirtualTmdbRef = (query: string): TmdbVirtualRef | null => {
    const trimmed = query.trim();

    const movieKeyMatch = VIRTUAL_MOVIE_KEY_PATTERN.exec(trimmed);
    if (movieKeyMatch) {
        const id = Number(movieKeyMatch[1]);
        return isUsableTmdbId(id) ? { kind: "movie", id } : null;
    }

    const keyMatch = VIRTUAL_KEY_PATTERN.exec(trimmed);
    if (keyMatch) {
        const id = Number(keyMatch[1]);
        return isUsableTmdbId(id) ? { kind: "tv", id } : null;
    }

    const numeric = Number(trimmed);
    if (!Number.isSafeInteger(numeric)) return null;

    if (numeric >= TMDB_VIRTUAL_MOVIE_ID_OFFSET && numeric < TMDB_VIRTUAL_MOVIE_ID_LIMIT) {
        const id = numeric - TMDB_VIRTUAL_MOVIE_ID_OFFSET;
        return isUsableTmdbId(id) ? { kind: "movie", id } : null;
    }

    if (numeric < TMDB_VIRTUAL_ID_OFFSET || numeric >= TMDB_VIRTUAL_ID_LIMIT) return null;

    const id = numeric - TMDB_VIRTUAL_ID_OFFSET;
    return isUsableTmdbId(id) ? { kind: "tv", id } : null;
};

const yearFromDate = (date: string | null | undefined): number | null => {
    if (!date) return null;
    const year = Number(date.slice(0, 4));
    return Number.isSafeInteger(year) && year > 0 ? year : null;
};

const formatScore = (value: number | null | undefined): string | null => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
    return value.toFixed(1);
};

const imageUrl = (baseUrl: string | null, size: string, path: string | null | undefined): string | null =>
    baseUrl && path ? `${baseUrl}${size}${path}` : null;

const toGenres = (names: readonly string[]): CatalogGenre[] =>
    names.map((name) => ({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, ""),
    }));

const demoEpisodeUrl = (demo: DemoAsset | null): string | null =>
    demo
        ? signedManifestUrl(demo.assetId, demo.assetVersion, demo.seriesKey, demo.episodeKey, "master")
        : null;

const baseVirtualSeries = (
    tmdbId: number,
    title: string,
    kind: TmdbVirtualKind = "tv",
): CatalogSeries => ({
    id: kind === "movie" ? virtualTmdbMovieId(tmdbId) : virtualTmdbSeriesId(tmdbId),
    key: kind === "movie" ? virtualTmdbMovieKey(tmdbId) : virtualTmdbKey(tmdbId),
    title,
    updatedAt: 0,
    groupId: null,
    baseTitle: null,
    seasonNumber: null,
    coverImage: "",
    sourceCoverImage: null,
    posterImage: null,
    backdropImage: null,
    backdropSource: null,
    logoImage: null,
    bannerImage: null,
    synopsis: null,
    rating: "TMDB",
    sourceRating: null,
    ageRating: null,
    year: null,
    focalX: null,
    focalY: null,
    safeLeft: null,
    safeBottom: null,
    dominantColor: null,
    placeholder: null,
    posterDominantColor: null,
    posterPlaceholder: null,
    backdropDominantColor: null,
    backdropPlaceholder: null,
    studio: null,
    audioLanguages: [],
    subtitleLanguages: [],
    metadataProvider: "tmdb",
    externalId: null,
    tmdbExternalId: tmdbId,
    genres: [],
    altTitles: [],
    hasMetadata: true,
    visibility: "public",
    access: "demo",
    episodeCount: 0,
    episodes: [],
});

export const virtualSeriesFromListItem = (
    item: TmdbTvListItem,
    imageBaseUrl: string | null,
    genres: readonly string[] = [],
): CatalogSeries => {
    const poster = imageUrl(imageBaseUrl, "w780", item.poster_path);
    const backdrop = imageUrl(imageBaseUrl, "w1280", item.backdrop_path);

    return {
        ...baseVirtualSeries(item.id, item.name),
        coverImage: poster ?? "",
        sourceCoverImage: poster,
        posterImage: poster,
        backdropImage: backdrop,
        bannerImage: backdrop,
        synopsis: item.overview?.trim() || null,
        sourceRating: formatScore(item.vote_average),
        year: yearFromDate(item.first_air_date),
        genres: toGenres(genres),
        episodes: [],
    };
};

export const virtualSeriesFromMovieListItem = (
    item: TmdbMovieListItem,
    imageBaseUrl: string | null,
    genres: readonly string[] = [],
): CatalogSeries => {
    const poster = imageUrl(imageBaseUrl, "w780", item.poster_path);
    const backdrop = imageUrl(imageBaseUrl, "w1280", item.backdrop_path);

    return {
        ...baseVirtualSeries(item.id, item.title, "movie"),
        coverImage: poster ?? "",
        sourceCoverImage: poster,
        posterImage: poster,
        backdropImage: backdrop,
        bannerImage: backdrop,
        synopsis: item.overview?.trim() || null,
        sourceRating: formatScore(item.vote_average),
        year: yearFromDate(item.release_date),
        genres: toGenres(genres),
        episodes: [],
    };
};

const VIRTUAL_EPISODE_KEY_PATTERN = /^(\d+)x(\d+)$/;

export const virtualEpisodeKey = (seasonNumber: number, episodeNumber: number): string =>
    `${seasonNumber}x${String(episodeNumber).padStart(2, "0")}`;

export const parseVirtualEpisodeKey = (
    key: string,
): { season: number; episode: number } | null => {
    const match = VIRTUAL_EPISODE_KEY_PATTERN.exec(key.trim());
    if (!match) return null;

    const season = Number(match[1]);
    const episode = Number(match[2]);
    if (!Number.isSafeInteger(season) || season <= 0) return null;
    if (!Number.isSafeInteger(episode) || episode <= 0) return null;

    return { season, episode };
};

const virtualEpisodes = (
    episodes: readonly { number: number; title: string | null; synopsis: string | null; stillPath: string | null }[],
    imageBaseUrl: string | null,
    demo: DemoAsset | null,
    seasonNumber: number,
): CatalogEpisode[] => {
    const url = demoEpisodeUrl(demo);

    return episodes
        .filter((episode) => Number.isSafeInteger(episode.number) && episode.number > 0)
        .map((episode) => ({
            key: virtualEpisodeKey(seasonNumber, episode.number),
            number: episode.number,
            sizeBytes: 0,
            addedAt: 0,
            title: episode.title,
            synopsis: episode.synopsis,
            durationSeconds: demo?.durationSeconds ?? null,
            thumbnail: imageUrl(imageBaseUrl, "w300", episode.stillPath),
            media: null,
            url,
        }));
};

const loadVirtualTmdbSeries = async (tmdbId: number): Promise<DataResult<CatalogSeries | null>> => {
    if (!isUsableTmdbId(tmdbId)) return dataEmpty(null);

    const externalId = `tv:${tmdbId}`;
    const [seriesResult, imageBaseResult, seasonsResult, artworkResult, demo] = await Promise.all([
        tmdbProvider.getSeries(externalId),
        getTmdbImageBaseUrl(),
        getTmdbSeasonSummaries(externalId),
        tmdbProvider.getArtwork?.(externalId) ?? Promise.resolve(null),
        getDemoAsset(),
    ]);

    if (seriesResult.kind === "error") return dataEmpty(null);

    const details = seriesResult.data;
    const imageBaseUrl = imageBaseResult.kind === "error" ? null : imageBaseResult.data;
    const artwork = artworkResult && artworkResult.kind !== "error" ? artworkResult.data : [];
    const poster = artwork.find((entry) => entry.kind === "poster")?.url ?? null;
    const backdrop = artwork.find((entry) => entry.kind === "backdrop")?.url ?? null;
    const logo = artwork.find((entry) => entry.kind === "logo")?.url ?? null;

    const seasonNumber = seasonsResult.kind === "error"
        ? 1
        : seasonsResult.data
            .map((season) => season.season_number)
            .filter((number) => Number.isSafeInteger(number) && number > 0)
            .sort((left, right) => left - right)[0] ?? 1;

    const episodesResult = await getTmdbSeasonEpisodes(externalId, seasonNumber);
    const episodes = episodesResult.kind === "error"
        ? []
        : virtualEpisodes(episodesResult.data, imageBaseUrl, demo, seasonNumber);

    return dataSuccess({
        ...baseVirtualSeries(tmdbId, details.titles.primary, "tv"),
        seasonNumber,
        coverImage: poster ?? "",
        sourceCoverImage: poster,
        posterImage: poster,
        backdropImage: backdrop,
        bannerImage: backdrop,
        logoImage: logo,
        synopsis: details.synopsis?.trim() || FALLBACK_SYNOPSIS,
        sourceRating: formatScore(details.score),
        ageRating: details.ageRating,
        year: details.year,
        studio: details.studio,
        genres: toGenres(details.genres),
        episodeCount: episodes.length,
        episodes,
    });
};

export const getVirtualTmdbSeries = cache(loadVirtualTmdbSeries);

export interface VirtualTmdbSeason {
    number: number;
    label: string;
    episodeCount: number;
}

const loadVirtualTmdbSeasons = async (tmdbId: number): Promise<VirtualTmdbSeason[]> => {
    if (!isUsableTmdbId(tmdbId)) return [];

    const result = await getTmdbSeasonSummaries(`tv:${tmdbId}`);
    if (result.kind === "error") return [];

    return result.data
        .filter((season) => Number.isSafeInteger(season.season_number) && season.season_number > 0)
        .map((season) => ({
            number: season.season_number,
            label: season.name?.trim() || `Sezon ${season.season_number}`,
            episodeCount: Number.isSafeInteger(season.episode_count) ? season.episode_count as number : 0,
        }))
        .sort((left, right) => left.number - right.number);
};

export const getVirtualTmdbSeasons = cache(loadVirtualTmdbSeasons);

const loadVirtualTmdbEpisodes = async (
    tmdbId: number,
    seasonNumber: number,
): Promise<CatalogEpisode[]> => {
    if (!isUsableTmdbId(tmdbId)) return [];

    const [episodes, imageBaseResult, demo] = await Promise.all([
        getTmdbSeasonEpisodes(`tv:${tmdbId}`, seasonNumber),
        getTmdbImageBaseUrl(),
        getDemoAsset(),
    ]);

    if (episodes.kind === "error") return [];

    return virtualEpisodes(
        episodes.data,
        imageBaseResult.kind === "error" ? null : imageBaseResult.data,
        demo,
        seasonNumber,
    );
};

export const getVirtualTmdbEpisodes = cache(loadVirtualTmdbEpisodes);

const loadVirtualTmdbMovie = async (tmdbId: number): Promise<DataResult<CatalogSeries | null>> => {
    if (!isUsableTmdbId(tmdbId)) return dataEmpty(null);

    const [movieResult, imageBaseResult, demo] = await Promise.all([
        getTmdbMovie(tmdbId),
        getTmdbImageBaseUrl(),
        getDemoAsset(),
    ]);

    if (movieResult.kind === "error") return dataEmpty(null);

    const movie = movieResult.data;
    const imageBaseUrl = imageBaseResult.kind === "error" ? null : imageBaseResult.data;
    const poster = imageUrl(imageBaseUrl, "w780", movie.posterPath);
    const backdrop = imageUrl(imageBaseUrl, "w1280", movie.backdropPath);
    const runtimeSeconds = movie.runtimeMinutes === null ? null : movie.runtimeMinutes * 60;

    const episode: CatalogEpisode = {
        key: virtualEpisodeKey(1, 1),
        number: 1,
        sizeBytes: 0,
        addedAt: 0,
        title: movie.title,
        synopsis: movie.synopsis,
        durationSeconds: demo?.durationSeconds ?? runtimeSeconds,
        thumbnail: imageUrl(imageBaseUrl, "w780", movie.backdropPath),
        media: null,
        url: demoEpisodeUrl(demo),
    };

    return dataSuccess({
        ...baseVirtualSeries(tmdbId, movie.title, "movie"),
        coverImage: poster ?? "",
        sourceCoverImage: poster,
        posterImage: poster,
        backdropImage: backdrop,
        bannerImage: backdrop,
        synopsis: movie.synopsis ?? FALLBACK_SYNOPSIS,
        sourceRating: formatScore(movie.score),
        ageRating: movie.ageRating,
        year: movie.year,
        studio: movie.studio,
        genres: toGenres(movie.genres),
        altTitles: movie.originalTitle && movie.originalTitle !== movie.title ? [movie.originalTitle] : [],
        episodeCount: 1,
        episodes: [episode],
    });
};

export const getVirtualTmdbMovie = cache(loadVirtualTmdbMovie);

export const getVirtualTmdbTitle = (
    ref: TmdbVirtualRef,
): Promise<DataResult<CatalogSeries | null>> =>
    ref.kind === "movie" ? getVirtualTmdbMovie(ref.id) : getVirtualTmdbSeries(ref.id);
