import "server-only";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import { readDbConfig } from "./env";

declare global {
    var __nocturnaDbPool: Pool | undefined;
    var __nocturnaDbQueryTimeoutMs: number | undefined;
}

export const getDbQueryTimeoutMs = (): number => {
    return globalThis.__nocturnaDbQueryTimeoutMs ?? 10_000;
};

type QueryOptions = { sql: string; timeout?: number };
type QueryMethod = (first: string | QueryOptions, ...rest: unknown[]) => unknown;

const withQueryTimeout = (first: string | QueryOptions, timeoutMs: number): QueryOptions =>
    typeof first === "string" ? { sql: first, timeout: timeoutMs } : { timeout: timeoutMs, ...first };

const timedQueryMethod = (target: object, original: QueryMethod, timeoutMs: number): QueryMethod =>
    (first, ...rest) => original.call(target, withQueryTimeout(first, timeoutMs), ...rest);

const applyQueryTimeout = <T extends Pool | PoolConnection>(target: T, timeoutMs: number): T => {
    const decorated = Object.create(target) as Record<string, unknown>;
    decorated.execute = timedQueryMethod(target, target.execute as unknown as QueryMethod, timeoutMs);
    decorated.query = timedQueryMethod(target, target.query as unknown as QueryMethod, timeoutMs);
    return decorated as unknown as T;
};

const poolWithQueryTimeout = (pool: Pool, timeoutMs: number): Pool => {
    const decorated = applyQueryTimeout(pool, timeoutMs) as unknown as Record<string, unknown>;
    decorated.getConnection = async (): Promise<PoolConnection> =>
        applyQueryTimeout(await pool.getConnection(), timeoutMs);
    return decorated as unknown as Pool;
};

export const getDbPool = (): Pool => {
    if (globalThis.__nocturnaDbPool) {
        return globalThis.__nocturnaDbPool;
    }

    const config = readDbConfig();

    const pool = mysql.createPool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionLimit: config.connectionLimit,
        connectTimeout: config.connectTimeoutMs,
        ssl: config.ssl,
        waitForConnections: true,
        queueLimit: config.queueLimit,
        namedPlaceholders: false,
        supportBigNumbers: true,
        bigNumberStrings: true,
        decimalNumbers: false,
        enableKeepAlive: true,
    });

    globalThis.__nocturnaDbPool = poolWithQueryTimeout(pool, config.queryTimeoutMs);
    globalThis.__nocturnaDbQueryTimeoutMs = config.queryTimeoutMs;
    return globalThis.__nocturnaDbPool;
};
