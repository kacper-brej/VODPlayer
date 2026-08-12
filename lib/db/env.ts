import "server-only";
import { readFileSync } from "node:fs";
import {
    EnvironmentConfigError,
    parseOptionalBoolean,
    parseOptionalInteger,
    requireEnvValue,
    type EnvSource,
} from "@/lib/config/env";

export interface DbConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    connectionLimit: number;
    queueLimit: number;
    connectTimeoutMs: number;
    queryTimeoutMs: number;
    ssl: { rejectUnauthorized: true; ca?: string } | undefined;
}

export class DbConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DbConfigError";
    }
}

const DEFAULT_PORT = 3306;
const DEFAULT_CONNECTION_LIMIT = 3;
const DEFAULT_QUEUE_LIMIT = 12;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_QUERY_TIMEOUT_MS = 10_000;

type CaFileReader = (path: string) => string;

export const readDbConfig = (
    env: EnvSource = process.env,
    readCaFile: CaFileReader = (path) => readFileSync(path, "utf8"),
): DbConfig => {
    try {
        const host = requireEnvValue(env, "DB_HOST");
        const database = requireEnvValue(env, "DB_NAME");
        const user = requireEnvValue(env, "DB_USER");
        const password = requireEnvValue(env, "DB_PASSWORD");
        const port = parseOptionalInteger(env, "DB_PORT", DEFAULT_PORT, 1, 65_535);
        const connectionLimit = parseOptionalInteger(
            env,
            "DB_CONNECTION_LIMIT",
            DEFAULT_CONNECTION_LIMIT,
            1,
            20,
        );
        const queueLimit = parseOptionalInteger(env, "DB_QUEUE_LIMIT", DEFAULT_QUEUE_LIMIT, 1, 100);
        const connectTimeoutMs = parseOptionalInteger(
            env, "DB_CONNECT_TIMEOUT_MS", DEFAULT_CONNECT_TIMEOUT_MS, 1_000, 30_000,
        );
        const queryTimeoutMs = parseOptionalInteger(
            env, "DB_QUERY_TIMEOUT_MS", DEFAULT_QUERY_TIMEOUT_MS, 1_000, 60_000,
        );
        const tlsEnabled = parseOptionalBoolean(env, "DB_SSL", false);
        const rejectUnauthorized = parseOptionalBoolean(env, "DB_SSL_REJECT_UNAUTHORIZED", true);

        if (!rejectUnauthorized) {
            throw new DbConfigError("DB_SSL_REJECT_UNAUTHORIZED=false jest zabronione.");
        }

        const inlineCa = env.DB_SSL_CA?.trim();
        const caPath = env.DB_SSL_CA_PATH?.trim();
        if (inlineCa && caPath) {
            throw new DbConfigError("Ustaw tylko jedną z DB_SSL_CA albo DB_SSL_CA_PATH.");
        }
        if (!tlsEnabled && (inlineCa || caPath || env.DB_SSL_REJECT_UNAUTHORIZED?.trim())) {
            throw new DbConfigError("Opcje certyfikatu DB wymagają DB_SSL=true.");
        }

        let ca: string | undefined = inlineCa;
        if (caPath) {
            try {
                ca = readCaFile(caPath).trim();
            } catch {
                throw new DbConfigError("Nie udało się odczytać certyfikatu z DB_SSL_CA_PATH.");
            }
            if (!ca) throw new DbConfigError("Certyfikat z DB_SSL_CA_PATH jest pusty.");
        }

        const ssl = tlsEnabled ? { rejectUnauthorized: true as const, ...(ca ? { ca } : {}) } : undefined;
        return {
            host, port, database, user, password, connectionLimit,
            queueLimit, connectTimeoutMs, queryTimeoutMs, ssl,
        };
    } catch (error) {
        if (error instanceof DbConfigError) throw error;
        if (error instanceof EnvironmentConfigError) throw new DbConfigError(error.message);
        throw error;
    }
};
