import "server-only";
import { cache } from "react";
import { validateTmdbMovieDetails, type TmdbMovieDetails } from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { fetchTmdbResult } from "@/lib/metadata/tmdbConfig";

const MOVIE_DETAILS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export interface TmdbMovie {
    id: number;
    title: string;
    originalTitle: string | null;
    synopsis: string | null;
    year: number | null;
    runtimeMinutes: number | null;
    score: number | null;
    ageRating: string | null;
    genres: string[];
    studio: string | null;
    posterPath: string | null;
    backdropPath: string | null;
}

const mapCertification = (certification: string | null): string | null => {
    if (!certification) return null;

    const normalized = certification.trim().toUpperCase();
    if (["G", "PG", "TV-Y", "TV-Y7", "TV-G", "TV-PG"].includes(normalized)) return "7+";
    if (["PG-13", "TV-14", "12", "12A"].includes(normalized)) return "12+";
    if (["R", "TV-MA", "15", "16"].includes(normalized)) return "16+";
    if (["NC-17", "18"].includes(normalized)) return "18+";

    return null;
};

const certificationFor = (details: TmdbMovieDetails): string | null => {
    const results = details.release_dates?.results ?? [];
    const preferred = results.find((entry) => entry.iso_3166_1 === "PL")
        ?? results.find((entry) => entry.iso_3166_1 === "US");

    const certification = preferred?.release_dates
        .map((entry) => entry.certification)
        .find((value) => Boolean(value?.trim())) ?? null;

    return mapCertification(certification);
};

const yearFromDate = (date: string | null): number | null => {
    if (!date) return null;
    const year = Number(date.slice(0, 4));
    return Number.isSafeInteger(year) && year > 0 ? year : null;
};

const positiveNumber = (value: number | null | undefined): number | null =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const mapDetails = (details: TmdbMovieDetails): TmdbMovie => ({
    id: details.id,
    title: details.title,
    originalTitle: details.original_title?.trim() || null,
    synopsis: details.overview?.trim() || null,
    year: yearFromDate(details.release_date),
    runtimeMinutes: positiveNumber(details.runtime),
    score: positiveNumber(details.vote_average),
    ageRating: certificationFor(details),
    genres: details.genres.map((genre) => genre.name),
    studio: details.production_companies[0]?.name ?? null,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
});

const loadMovie = async (tmdbId: number): Promise<DataResult<TmdbMovie>> => {
    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return dataFailure("invalid_response");

    const response = await fetchTmdbResult(
        `/movie/${tmdbId}?language=pl-PL&append_to_response=release_dates`,
        (value) => validateTmdbMovieDetails(value).ok,
        { cacheTtlMs: MOVIE_DETAILS_CACHE_TTL_MS, maxRetries: 1 },
    );

    if (response.kind === "error") return response;

    const parsed = validateTmdbMovieDetails(response.data);
    return parsed.ok ? dataSuccess(mapDetails(parsed.data)) : dataFailure("invalid_response");
};

export const getTmdbMovie = cache(loadMovie);
