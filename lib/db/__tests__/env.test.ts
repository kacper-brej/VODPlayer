import { describe, expect, it } from "vitest";
import { DbConfigError, readDbConfig } from "../env";

const baseEnv: Record<string, string | undefined> = {
    DB_HOST: "db.lh.pl",
    DB_NAME: "nocturna",
    DB_USER: "nocturna_user",
    DB_PASSWORD: "secret",
};

describe("readDbConfig", () => {
    it("czyta poprawną konfigurację z domyślnym portem i limitem połączeń", () => {
        const config = readDbConfig(baseEnv);

        expect(config).toEqual({
            host: "db.lh.pl",
            port: 3306,
            database: "nocturna",
            user: "nocturna_user",
            password: "secret",
            connectionLimit: 3,
            queueLimit: 12,
            connectTimeoutMs: 5000,
            queryTimeoutMs: 10000,
            ssl: undefined,
        });
    });

    it.each(["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const)(
        "rzuca DbConfigError, gdy brakuje %s",
        (missingKey) => {
            const env = { ...baseEnv, [missingKey]: undefined };
            expect(() => readDbConfig(env)).toThrow(DbConfigError);
        },
    );

    it("rzuca DbConfigError przy niepoprawnym DB_PORT", () => {
        expect(() => readDbConfig({ ...baseEnv, DB_PORT: "not-a-number" })).toThrow(DbConfigError);
        expect(() => readDbConfig({ ...baseEnv, DB_PORT: "0" })).toThrow(DbConfigError);
        expect(() => readDbConfig({ ...baseEnv, DB_PORT: "70000" })).toThrow(DbConfigError);
    });

    it("akceptuje poprawny niestandardowy DB_PORT", () => {
        const config = readDbConfig({ ...baseEnv, DB_PORT: "3307" });
        expect(config.port).toBe(3307);
    });

    it("rzuca DbConfigError przy DB_CONNECTION_LIMIT poza zakresem 1-20 (LH ma niski limit współdzielony)", () => {
        expect(() => readDbConfig({ ...baseEnv, DB_CONNECTION_LIMIT: "0" })).toThrow(DbConfigError);
        expect(() => readDbConfig({ ...baseEnv, DB_CONNECTION_LIMIT: "21" })).toThrow(DbConfigError);
    });

    it("włącza SSL tylko gdy DB_SSL=true i zawsze weryfikuje certyfikat", () => {
        const withSsl = readDbConfig({ ...baseEnv, DB_SSL: "true" });
        expect(withSsl.ssl).toEqual({ rejectUnauthorized: true });

        expect(() => readDbConfig({
            ...baseEnv,
            DB_SSL: "true",
            DB_SSL_REJECT_UNAUTHORIZED: "false",
        })).toThrow("zabronione");

        const withoutSsl = readDbConfig(baseEnv);
        expect(withoutSsl.ssl).toBeUndefined();
    });

    it("odrzuca niejednoznaczne booleany i opcje certyfikatu bez TLS", () => {
        expect(() => readDbConfig({ ...baseEnv, DB_SSL: "yes" })).toThrow(DbConfigError);
        expect(() => readDbConfig({ ...baseEnv, DB_SSL_CA: "pem" })).toThrow("DB_SSL=true");
    });

    it("obsługuje własny CA inline albo przez server-only ścieżkę", () => {
        expect(readDbConfig({ ...baseEnv, DB_SSL: "true", DB_SSL_CA: "  PEM INLINE  " }).ssl)
            .toEqual({ rejectUnauthorized: true, ca: "PEM INLINE" });

        const readCaFile = (path: string): string => {
            expect(path).toBe("/run/secrets/mysql-ca.pem");
            return "PEM FROM FILE";
        };
        expect(readDbConfig({
            ...baseEnv,
            DB_SSL: "true",
            DB_SSL_CA_PATH: "/run/secrets/mysql-ca.pem",
        }, readCaFile).ssl).toEqual({ rejectUnauthorized: true, ca: "PEM FROM FILE" });
    });

    it("odrzuca jednoczesne CA inline i ścieżkę", () => {
        expect(() => readDbConfig({
            ...baseEnv,
            DB_SSL: "true",
            DB_SSL_CA: "PEM",
            DB_SSL_CA_PATH: "/ca.pem",
        })).toThrow("tylko jedną");
    });
});
