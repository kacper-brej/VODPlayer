import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { AdminLibraryResponse, SeriesVisibility } from "@/lib/core/contracts";
import { normalizeVisibility } from "@/lib/access/seriesAccessService";

type Executor = Pool | PoolConnection;

interface LibraryRow extends RowDataPacket {
    series_key: string;
    episode_key: string;
    size_bytes: number | null;
    title: string | null;
    duration_seconds: number | null;
    visibility: SeriesVisibility | null;
}

export const listAdminLibrary = async (db: Executor = getDbPool()): Promise<AdminLibraryResponse> => {
    try {
        const [rows] = await db.execute<LibraryRow[]>(
            `SELECT a.series_key, a.episode_key, a.total_size_bytes AS size_bytes,
                    e.title, COALESCE(e.duration_seconds, a.duration_seconds) AS duration_seconds,
                    sa.visibility
             FROM media_assets a
             LEFT JOIN episodes_metadata e
               ON e.series_key = a.series_key AND e.episode_key = a.episode_key
             LEFT JOIN series_access sa ON sa.series_key = a.series_key
             WHERE a.status = 'ready'
             ORDER BY a.series_key, a.episode_key`,
        );

        const grouped = new Map<string, AdminLibraryResponse["series"][number]>();
        for (const row of rows) {
            let series = grouped.get(row.series_key);
            if (!series) {
                series = {
                    seriesKey: row.series_key,
                    episodeCount: 0,
                    totalBytes: 0,
                    visibility: normalizeVisibility(row.visibility),
                    episodes: [],
                };
                grouped.set(row.series_key, series);
            }
            const sizeBytes = Number(row.size_bytes ?? 0);
            series.episodes.push({
                episodeKey: row.episode_key,
                sizeBytes,
                title: row.title,
                durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
            });
            series.episodeCount += 1;
            series.totalBytes += sizeBytes;
        }
        return { series: [...grouped.values()] };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
