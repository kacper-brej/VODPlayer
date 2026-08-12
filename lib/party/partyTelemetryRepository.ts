import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";

type Executor = Pool | PoolConnection;

export interface PartyTelemetryReport {
    sessionId: string;
    driftBuckets: [number, number, number, number, number];
    hardSeeks: number;
    timeToSyncMs: number | null;
}

interface OverviewRow extends RowDataPacket {
    sessions: string | number;
    drift_samples: string | number;
    drift_dead_zone: string | number;
    drift_under_half: string | number;
    drift_under_one: string | number;
    drift_under_two: string | number;
    drift_over_two: string | number;
    hard_seeks: string | number;
    synced_sessions: string | number;
    sync_time_total_ms: string | number;
    sync_time_max_ms: string | number;
    buffering_cycles: string | number;
    buffering_recovered: string | number;
    buffering_timed_out: string | number;
}

export const upsertPartyTelemetry = async (
    report: PartyTelemetryReport,
    db: Executor = getDbPool(),
): Promise<void> => {
    const samples = report.driftBuckets.reduce((total, value) => total + value, 0);
    try {
        await db.execute(
            `INSERT INTO watch_party_sync_sessions (
                session_id, metric_date, drift_samples, drift_dead_zone, drift_under_half,
                drift_under_one, drift_under_two, drift_over_two, hard_seeks, time_to_sync_ms
             ) VALUES (?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                drift_samples = GREATEST(drift_samples, VALUES(drift_samples)),
                drift_dead_zone = GREATEST(drift_dead_zone, VALUES(drift_dead_zone)),
                drift_under_half = GREATEST(drift_under_half, VALUES(drift_under_half)),
                drift_under_one = GREATEST(drift_under_one, VALUES(drift_under_one)),
                drift_under_two = GREATEST(drift_under_two, VALUES(drift_under_two)),
                drift_over_two = GREATEST(drift_over_two, VALUES(drift_over_two)),
                hard_seeks = GREATEST(hard_seeks, VALUES(hard_seeks)),
                time_to_sync_ms = COALESCE(time_to_sync_ms, VALUES(time_to_sync_ms))`,
            [report.sessionId, samples, ...report.driftBuckets, report.hardSeeks, report.timeToSyncMs],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const recordBufferingCycle = async (db: Executor = getDbPool()): Promise<void> => {
    try {
        await db.execute(
            `INSERT INTO watch_party_buffering_daily (metric_date, cycles)
             VALUES (CURRENT_DATE(), 1)
             ON DUPLICATE KEY UPDATE cycles = cycles + 1`,
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const recordBufferingExit = async (
    reason: "recovered" | "timed-out",
    db: Executor = getDbPool(),
): Promise<void> => {
    const column = reason === "recovered" ? "recovered" : "timed_out";
    try {
        await db.execute(
            `INSERT INTO watch_party_buffering_daily (metric_date, ${column})
             VALUES (CURRENT_DATE(), 1)
             ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const getPartyTelemetryOverview = async (
    days = 30,
    db: Executor = getDbPool(),
): Promise<OverviewRow> => {
    try {
        const [rows] = await db.execute<OverviewRow[]>(
            `SELECT
                COUNT(DISTINCT s.session_id) AS sessions,
                COALESCE(SUM(s.drift_samples), 0) AS drift_samples,
                COALESCE(SUM(s.drift_dead_zone), 0) AS drift_dead_zone,
                COALESCE(SUM(s.drift_under_half), 0) AS drift_under_half,
                COALESCE(SUM(s.drift_under_one), 0) AS drift_under_one,
                COALESCE(SUM(s.drift_under_two), 0) AS drift_under_two,
                COALESCE(SUM(s.drift_over_two), 0) AS drift_over_two,
                COALESCE(SUM(s.hard_seeks), 0) AS hard_seeks,
                COUNT(s.time_to_sync_ms) AS synced_sessions,
                COALESCE(SUM(s.time_to_sync_ms), 0) AS sync_time_total_ms,
                COALESCE(MAX(s.time_to_sync_ms), 0) AS sync_time_max_ms,
                COALESCE((SELECT SUM(b.cycles) FROM watch_party_buffering_daily b WHERE b.metric_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)), 0) AS buffering_cycles,
                COALESCE((SELECT SUM(b.recovered) FROM watch_party_buffering_daily b WHERE b.metric_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)), 0) AS buffering_recovered,
                COALESCE((SELECT SUM(b.timed_out) FROM watch_party_buffering_daily b WHERE b.metric_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)), 0) AS buffering_timed_out
             FROM watch_party_sync_sessions s
             WHERE s.metric_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)`,
            [days, days, days, days],
        );
        return rows[0];
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
