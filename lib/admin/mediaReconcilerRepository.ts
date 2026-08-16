import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { MediaAssetStatus } from "@/lib/media/mediaLifecycle";

type Executor = Pool | PoolConnection;

interface AssetRow extends RowDataPacket {
    id: number;
    series_key: string;
    episode_key: string;
    status: MediaAssetStatus;
    storage_prefix: string;
}

interface PlaylistRow extends RowDataPacket {
    asset_id: number;
    playlist_key: string;
}

export interface ReconciliationAsset {
    id: number;
    seriesKey: string;
    episodeKey: string;
    status: MediaAssetStatus;
    storagePrefix: string;
    playlistKeys: string[];
}

export const listAssetsForReconciliation = async (db: Executor = getDbPool()): Promise<ReconciliationAsset[]> => {
    try {
        const [assets] = await db.execute<AssetRow[]>(
            // delivery='file' wykluczone: te assety nie maja obiektow w B2,
            // wiec porownanie prefiksow zglosiloby je jako brakujace (ADR-043).
            `SELECT id, series_key, episode_key, status, storage_prefix FROM media_assets
             WHERE status IN ('ready', 'deleting', 'delete_failed', 'deleted')
               AND delivery = 'hls'`,
        );
        const [playlists] = await db.execute<PlaylistRow[]>(
            `SELECT r.asset_id, r.playlist_key FROM media_renditions r
             INNER JOIN media_assets a ON a.id = r.asset_id
             WHERE a.status = 'ready'`,
        );
        const byAsset = new Map<number, string[]>();
        for (const row of playlists) {
            const bucket = byAsset.get(row.asset_id);
            if (bucket) bucket.push(row.playlist_key);
            else byAsset.set(row.asset_id, [row.playlist_key]);
        }
        return assets.map((row) => ({
            id: row.id,
            seriesKey: row.series_key,
            episodeKey: row.episode_key,
            status: row.status,
            storagePrefix: row.storage_prefix,
            playlistKeys: byAsset.get(row.id) ?? [],
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
