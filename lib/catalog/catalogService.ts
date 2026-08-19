import "server-only";
import type { CatalogEpisodePayload, CatalogGenre, CatalogResponse, CatalogSeriesPayload } from "@/lib/core/contracts";
import { loadCatalogRows, type CatalogArtworkRow } from "@/lib/catalog/catalogRepository";
import { parseNullableSafeDbInteger, parseSafeDbInteger } from "@/lib/db/integer";
import { normalizeVisibility } from "@/lib/access/seriesAccessService";

const splitLanguages = (value: string | null): string[] =>
    value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];

const numberOrNull = (value: string | number | null): number | null =>
    value === null ? null : Number(value);

const tmdbIdOrNull = (value: string | null): number | null => {
    const match = /^(?:tv:)?(\d+)$/.exec(value?.trim() ?? "");
    if (!match) return null;

    const id = Number(match[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const episodeNumber = (episodeKey: string, fallback: number): number => {
    const parsed = Number.parseInt(episodeKey.replace(/\.mp4$/i, ""), 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const thumbnailUrl = (source: string | null, path: string | null): string | null => {
    if (!path) return null;
    if (source === "tmdb") return `https://image.tmdb.org/t/p/w300${path}`;
    return null;
};

const validArtwork = (row: CatalogArtworkRow): boolean => {
    if (row.width === null || row.height === null) return true;
    if (row.kind === "poster") return row.width < row.height;
    if (row.kind === "backdrop") return row.width > row.height;
    return true;
};

export const buildCatalog = async (): Promise<CatalogResponse> => {
    const rows = await loadCatalogRows();
    const heights = new Map<string, number[]>();
    for (const rendition of rows.renditions) {
        const assetKey = String(rendition.asset_id);
        const bucket = heights.get(assetKey);
        if (bucket) bucket.push(Number(rendition.height));
        else heights.set(assetKey, [Number(rendition.height)]);
    }

    const artwork = new Map<string, Partial<Record<CatalogArtworkRow["kind"], CatalogArtworkRow>>>();
    for (const item of rows.artwork) {
        if (!validArtwork(item)) continue;
        const bucket = artwork.get(item.series_key) ?? {};
        bucket[item.kind] = item;
        artwork.set(item.series_key, bucket);
    }

    const genres = new Map<string, CatalogGenre[]>();
    for (const item of rows.genres) {
        const bucket = genres.get(item.series_key);
        const genre = { name: item.name, slug: item.slug };
        if (bucket) bucket.push(genre);
        else genres.set(item.series_key, [genre]);
    }

    const titles = new Map<string, string[]>();
    for (const item of rows.titles) {
        const bucket = titles.get(item.series_key);
        if (bucket) bucket.push(item.title);
        else titles.set(item.series_key, [item.title]);
    }

    const series = new Map<string, CatalogSeriesPayload>();
    for (const row of rows.assets) {
        let entry = series.get(row.series_key);
        if (!entry) {
            const images = artwork.get(row.series_key) ?? {};
            const poster = images.poster;
            const backdrop = images.backdrop;
            const logo = images.logo;
            entry = {
                id: parseSafeDbInteger(row.series_id, "series_id"),
                key: row.series_key,
                title: row.series_key,
                updatedAt: parseSafeDbInteger(row.updated_at, "updated_at"),
                groupId: parseNullableSafeDbInteger(row.group_id, "group_id"),
                baseTitle: row.base_title,
                seasonNumber: row.season_number === null ? null : Number(row.season_number),
                coverImage: poster?.url ?? row.cover_image,
                posterImage: poster?.url ?? row.cover_image,
                backdropImage: backdrop?.url ?? row.backdrop_image,
                backdropSource: row.backdrop_source === "jikan" || row.backdrop_source === "manual" ? row.backdrop_source : null,
                logoImage: logo?.url ?? null,
                synopsis: row.synopsis,
                rating: row.rating,
                ageRating: row.age_rating,
                year: row.year === null ? null : Number(row.year),
                focalX: numberOrNull(row.focal_x),
                focalY: numberOrNull(row.focal_y),
                safeLeft: numberOrNull(row.safe_left),
                safeBottom: numberOrNull(row.safe_bottom),
                dominantColor: row.dominant_color,
                placeholder: row.placeholder,
                posterDominantColor: poster?.dominant_color ?? (row.backdrop_image === null ? row.dominant_color : null),
                posterPlaceholder: poster?.placeholder ?? (row.backdrop_image === null ? row.placeholder : null),
                backdropDominantColor: backdrop?.dominant_color ?? row.dominant_color,
                backdropPlaceholder: backdrop?.placeholder ?? row.placeholder,
                studio: row.studio,
                audioLanguages: splitLanguages(row.audio_languages),
                subtitleLanguages: splitLanguages(row.subtitle_languages),
                metadataProvider: row.metadata_provider,
                externalId: row.external_id === null ? null : Number(row.external_id),
                tmdbExternalId: tmdbIdOrNull(row.tmdb_external_id),
                genres: genres.get(row.series_key) ?? [],
                altTitles: [...new Set(titles.get(row.series_key) ?? [])],
                hasMetadata: row.cover_row_title !== null,
                visibility: normalizeVisibility(row.visibility),
                episodeCount: 0,
                episodes: [],
            };
            series.set(row.series_key, entry);
        }

        const episode: CatalogEpisodePayload = {
            key: row.episode_key,
            number: episodeNumber(row.episode_key, entry.episodes.length + 1),
            sizeBytes: parseSafeDbInteger(row.total_size_bytes ?? 0, "total_size_bytes"),
            addedAt: parseSafeDbInteger(row.added_at, "added_at"),
            title: row.episode_title,
            synopsis: row.episode_synopsis,
            durationSeconds: row.episode_duration_seconds === null
                ? row.asset_duration_seconds === null ? null : Number(row.asset_duration_seconds)
                : Number(row.episode_duration_seconds),
            thumbnail: thumbnailUrl(row.thumbnail_source, row.thumbnail_path),
            media: {
                assetId: parseSafeDbInteger(row.asset_id, "asset_id"),
                assetVersion: parseSafeDbInteger(row.asset_version, "asset_version"),
                status: "ready",
                delivery: row.delivery === "file" ? "file" : "hls",
                heights: heights.get(String(row.asset_id)) ?? [],
                previewStartSeconds: row.preview_start_seconds === null ? null : Number(row.preview_start_seconds),
                hasPreviewClip: row.preview_clip_key !== null,
            },
        };
        entry.episodes.push(episode);
        entry.episodeCount = entry.episodes.length;
        entry.updatedAt = Math.max(entry.updatedAt, parseSafeDbInteger(row.updated_at, "updated_at"));
    }

    return { generatedAt: Math.floor(Date.now() / 1000), series: [...series.values()] };
};
