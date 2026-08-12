import "server-only";
import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";

type Executor = Pool | PoolConnection;

export interface CoverMetadataWrite {
    title: string;
    coverImage: string | null;
    backdropImage: string | null;
    backdropSource: "jikan" | "manual" | null;
    synopsis: string | null;
    rating: string | null;
    ageRating: string | null;
    year: number | null;
    focalX?: number | null;
    focalY?: number | null;
    safeLeft?: number | null;
    safeBottom?: number | null;
    dominantColor?: string | null;
    placeholder?: string | null;
    studio: string | null;
    audioLanguages?: string[];
    subtitleLanguages?: string[];
    metadataSource?: string | null;
    metadataProvider?: "jikan" | null;
    externalId?: number | null;
    genres?: string[];
}

const normalizeLanguages = (values: string[] | undefined): string | null => {
    const normalized = Array.from(new Set((values ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter((value) => /^[a-z]{2,3}$/.test(value))));
    return normalized.length === 0 ? null : normalized.join(",").slice(0, 255);
};

const genreSlug = (name: string): string => name
    .trim()
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const upsertCoverMetadata = async (
    input: CoverMetadataWrite,
    db: Executor = getDbPool(),
): Promise<void> => {
    await db.execute(
        `INSERT INTO local_series_covers
            (title, cover_image, poster_image, backdrop_image, backdrop_source,
             synopsis, rating, age_rating, year, focal_x, focal_y, safe_left, safe_bottom,
             dominant_color, placeholder, studio, audio_languages, subtitle_languages,
             metadata_source, metadata_provider, external_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            cover_image = COALESCE(VALUES(cover_image), cover_image),
            poster_image = COALESCE(VALUES(poster_image), poster_image),
            backdrop_image = CASE
                WHEN VALUES(backdrop_source) = 'manual' THEN VALUES(backdrop_image)
                WHEN backdrop_source = 'manual' THEN backdrop_image
                ELSE COALESCE(VALUES(backdrop_image), backdrop_image)
            END,
            backdrop_source = CASE
                WHEN VALUES(backdrop_source) = 'manual' THEN 'manual'
                WHEN backdrop_source = 'manual' THEN backdrop_source
                ELSE COALESCE(VALUES(backdrop_source), backdrop_source)
            END,
            synopsis = COALESCE(VALUES(synopsis), synopsis),
            rating = COALESCE(VALUES(rating), rating), age_rating = COALESCE(VALUES(age_rating), age_rating),
            year = COALESCE(VALUES(year), year), focal_x = COALESCE(VALUES(focal_x), focal_x),
            focal_y = COALESCE(VALUES(focal_y), focal_y), safe_left = COALESCE(VALUES(safe_left), safe_left),
            safe_bottom = COALESCE(VALUES(safe_bottom), safe_bottom),
            dominant_color = COALESCE(VALUES(dominant_color), dominant_color),
            placeholder = COALESCE(VALUES(placeholder), placeholder), studio = COALESCE(VALUES(studio), studio),
            audio_languages = COALESCE(VALUES(audio_languages), audio_languages),
            subtitle_languages = COALESCE(VALUES(subtitle_languages), subtitle_languages),
            metadata_source = COALESCE(VALUES(metadata_source), metadata_source),
            metadata_provider = COALESCE(VALUES(metadata_provider), metadata_provider),
            external_id = COALESCE(VALUES(external_id), external_id), updated_at = NOW()`,
        [input.title, input.coverImage, input.coverImage, input.backdropImage, input.backdropSource,
            input.synopsis, input.rating, input.ageRating, input.year, input.focalX ?? null, input.focalY ?? null,
            input.safeLeft ?? null, input.safeBottom ?? null, input.dominantColor ?? null, input.placeholder ?? null,
            input.studio?.trim().slice(0, 255) || null, normalizeLanguages(input.audioLanguages),
            normalizeLanguages(input.subtitleLanguages), input.metadataSource ?? null, input.metadataProvider ?? null,
            input.externalId ?? null],
    );
};

export const syncSeriesGenres = async (
    seriesKey: string,
    names: string[],
    db: Executor = getDbPool(),
): Promise<void> => {
    const ids: number[] = [];
    for (const name of names) {
        const clean = name.trim();
        const slug = genreSlug(clean);
        if (!clean || clean.length > 100 || !slug || slug.length > 100) continue;
        const [result] = await db.execute<ResultSetHeader>(
            "INSERT INTO genres (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
            [clean, slug],
        );
        if (result.insertId > 0) ids.push(result.insertId);
    }
    await db.execute("DELETE FROM series_genres WHERE series_key = ?", [seriesKey]);
    for (const genreId of new Set(ids)) {
        await db.execute("INSERT IGNORE INTO series_genres (series_key, genre_id) VALUES (?, ?)", [seriesKey, genreId]);
    }
};
