import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";

type Executor = Pool | PoolConnection;

export interface HlsRendition {
    height: number;
    width: number | null;
    bitrateKbps: number;
    playlistKey: string;
}

export interface ReadyHlsAsset {
    id: number;
    version: number;
    durationSeconds: number | null;
    renditions: HlsRendition[];
}

interface RenditionSqlRow extends RowDataPacket {
    asset_id: number;
    asset_version: number;
    duration_seconds: number | null;
    height: number;
    width: number | null;
    bitrate_kbps: number;
    playlist_key: string;
}

export const findReadyHlsAsset = async (
    assetId: number,
    assetVersion: number,
    seriesKey: string,
    episodeKey: string,
    db: Executor = getDbPool(),
): Promise<ReadyHlsAsset | null> => {
    try {
        const [rows] = await db.execute<RenditionSqlRow[]>(
            `SELECT a.id AS asset_id, a.asset_version, a.duration_seconds,
                    r.height, r.width, r.bitrate_kbps, r.playlist_key
             FROM media_renditions r
             JOIN media_assets a ON a.id = r.asset_id
             WHERE a.id = ? AND a.asset_version = ?
               AND a.series_key = ? AND a.episode_key = ? AND a.status = 'ready'
             ORDER BY r.bitrate_kbps ASC`,
            [assetId, assetVersion, seriesKey, episodeKey],
        );

        if (rows.length === 0) return null;

        return {
            id: Number(rows[0].asset_id),
            version: Number(rows[0].asset_version),
            durationSeconds: rows[0].duration_seconds === null ? null : Number(rows[0].duration_seconds),
            renditions: rows.map((row) => ({
                height: Number(row.height),
                width: row.width === null ? null : Number(row.width),
                bitrateKbps: Number(row.bitrate_kbps),
                playlistKey: row.playlist_key,
            })),
        };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findReadyHlsAssetByMediaKey = async (
    seriesKey: string,
    episodeKey: string,
    db: Executor = getDbPool(),
): Promise<ReadyHlsAsset | null> => {
    try {
        const [identityRows] = await db.execute<Array<RowDataPacket & { id: number; asset_version: number }>>(
            `SELECT id, asset_version FROM media_assets
             WHERE series_key = ? AND episode_key = ? AND status = 'ready' LIMIT 1`,
            [seriesKey, episodeKey],
        );
        const identity = identityRows[0];
        if (!identity) return null;
        return findReadyHlsAsset(Number(identity.id), Number(identity.asset_version), seriesKey, episodeKey, db);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
