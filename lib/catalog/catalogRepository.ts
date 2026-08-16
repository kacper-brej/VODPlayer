import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { DatabaseError, mapDatabaseError } from "@/lib/db/errors";
import type { DbInteger } from "@/lib/db/integer";
import { observeDbOperation } from "@/lib/db/metrics";
import { mapWithConcurrency } from "@/lib/core/mapWithConcurrency";
import type { SeriesVisibility } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

export interface CatalogAssetRow extends RowDataPacket {
    asset_id: DbInteger;
    asset_version: DbInteger;
    series_key: string;
    episode_key: string;
    delivery: "hls" | "file";
    asset_duration_seconds: number | null;
    total_size_bytes: DbInteger | null;
    preview_start_seconds: number | null;
    preview_clip_key: string | null;
    added_at: DbInteger;
    updated_at: DbInteger;
    series_id: DbInteger;
    group_id: DbInteger | null;
    season_number: number | null;
    base_title: string | null;
    cover_row_title: string | null;
    cover_image: string | null;
    backdrop_image: string | null;
    backdrop_source: string | null;
    synopsis: string | null;
    rating: string | null;
    age_rating: string | null;
    year: number | null;
    focal_x: string | number | null;
    focal_y: string | number | null;
    safe_left: string | number | null;
    safe_bottom: string | number | null;
    dominant_color: string | null;
    placeholder: string | null;
    studio: string | null;
    audio_languages: string | null;
    subtitle_languages: string | null;
    metadata_provider: string | null;
    external_id: number | null;
    episode_title: string | null;
    episode_synopsis: string | null;
    episode_duration_seconds: number | null;
    thumbnail_path: string | null;
    thumbnail_source: string | null;
    visibility: SeriesVisibility | null;
}

export interface CatalogRenditionRow extends RowDataPacket { asset_id: DbInteger; height: number }
export interface CatalogArtworkRow extends RowDataPacket {
    series_key: string;
    kind: "poster" | "backdrop" | "logo";
    url: string;
    width: number | null;
    height: number | null;
    dominant_color: string | null;
    placeholder: string | null;
}
export interface CatalogGenreRow extends RowDataPacket { series_key: string; name: string; slug: string }
export interface CatalogTitleRow extends RowDataPacket { series_key: string; title: string }

export interface CatalogDatabaseRows {
    assets: CatalogAssetRow[];
    renditions: CatalogRenditionRow[];
    artwork: CatalogArtworkRow[];
    genres: CatalogGenreRow[];
    titles: CatalogTitleRow[];
}

const executeCatalogQuery = <T extends RowDataPacket[]>(
    db: Executor,
    operation: string,
    sql: string,
) => observeDbOperation(operation, () => db.execute<T>(sql));

export const loadCatalogRows = async (db: Executor = getDbPool()): Promise<CatalogDatabaseRows> => {
    try {
        const tasks: Array<() => Promise<unknown>> = [
            () => executeCatalogQuery<CatalogAssetRow[]>(db, "catalog.assets",
                `SELECT a.id AS asset_id, a.asset_version, a.series_key, a.episode_key,
                        a.delivery,
                        a.duration_seconds AS asset_duration_seconds, a.total_size_bytes,
                        a.preview_start_seconds, a.preview_clip_key,
                        UNIX_TIMESTAMP(a.created_at) AS added_at, UNIX_TIMESTAMP(a.updated_at) AS updated_at,
                        i.id AS series_id, i.group_id, i.season_number, g.base_title,
                        c.title AS cover_row_title, c.cover_image, c.backdrop_image, c.backdrop_source, c.synopsis, c.rating,
                        c.age_rating, c.year, c.focal_x, c.focal_y, c.safe_left, c.safe_bottom,
                        c.dominant_color, c.placeholder, c.studio, c.audio_languages,
                        c.subtitle_languages, c.metadata_provider, c.external_id,
                        e.title AS episode_title, e.synopsis AS episode_synopsis,
                        e.duration_seconds AS episode_duration_seconds,
                        e.thumbnail_path, e.thumbnail_source,
                        sa.visibility
                 FROM media_assets a
                 INNER JOIN series_identities i ON i.series_key = a.series_key
                 LEFT JOIN series_groups g ON g.id = i.group_id
                 LEFT JOIN local_series_covers c ON c.title = a.series_key
                 LEFT JOIN episodes_metadata e
                   ON e.series_key = a.series_key AND e.episode_key = a.episode_key
                 LEFT JOIN series_access sa ON sa.series_key = a.series_key
                 WHERE a.status = 'ready'
                   AND COALESCE(sa.visibility, 'restricted') <> 'system'
                   AND EXISTS (
                       SELECT 1 FROM series_artwork published
                       WHERE published.series_key = a.series_key
                         AND published.kind = 'poster' AND published.is_primary = 1
                   )
                 ORDER BY a.series_key, a.episode_key`,
            ),
            () => executeCatalogQuery<CatalogRenditionRow[]>(db, "catalog.renditions",
                `SELECT r.asset_id, r.height
                 FROM media_renditions r
                 INNER JOIN media_assets a ON a.id = r.asset_id
                 WHERE a.status = 'ready'
                 ORDER BY r.asset_id, r.height`,
            ),
            () => executeCatalogQuery<CatalogArtworkRow[]>(db, "catalog.artwork",
                `SELECT series_key, kind, url, width, height, dominant_color, placeholder
                 FROM series_artwork WHERE is_primary = 1`,
            ),
            () => executeCatalogQuery<CatalogGenreRow[]>(db, "catalog.genres",
                `SELECT sg.series_key, g.name, g.slug
                 FROM series_genres sg INNER JOIN genres g ON g.id = sg.genre_id
                 ORDER BY g.name`,
            ),
            () => executeCatalogQuery<CatalogTitleRow[]>(db, "catalog.titles",
                `SELECT series_key, title FROM series_titles WHERE kind != 'primary' ORDER BY title`,
            ),
        ];
        const [assetsResult, renditionsResult, artworkResult, genresResult, titlesResult] =
            await mapWithConcurrency(tasks, 2, (task) => task()) as [
                [CatalogAssetRow[]],
                [CatalogRenditionRow[]],
                [CatalogArtworkRow[]],
                [CatalogGenreRow[]],
                [CatalogTitleRow[]],
            ];

        return {
            assets: assetsResult[0],
            renditions: renditionsResult[0],
            artwork: artworkResult[0],
            genres: genresResult[0],
            titles: titlesResult[0],
        };
    } catch (error) {
        if (error instanceof DatabaseError) throw error;
        throw mapDatabaseError(error);
    }
};
