import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn(async () => [[], []]);
const query = vi.fn(async () => [[], []]);
const connectionExecute = vi.fn(async () => [[], []]);
const connectionQuery = vi.fn(async () => [[], []]);
const release = vi.fn();
const getConnection = vi.fn(async () => ({
    execute: connectionExecute,
    query: connectionQuery,
    release,
}));

const createPool = vi.fn(() => ({ marker: "pool", execute, query, getConnection }));
vi.mock("mysql2/promise", () => ({ default: { createPool } }));
vi.mock("../env", () => ({
    readDbConfig: () => ({
        host: "db.example",
        port: 3306,
        database: "nocturna",
        user: "user",
        password: "secret",
        connectionLimit: 3,
        queueLimit: 12,
        connectTimeoutMs: 5000,
        queryTimeoutMs: 10000,
        ssl: undefined,
    }),
}));

const { getDbPool, getDbQueryTimeoutMs } = await import("../pool");

describe("getDbPool", () => {
    beforeEach(() => {
        globalThis.__nocturnaDbPool = undefined;
        globalThis.__nocturnaDbQueryTimeoutMs = undefined;
        vi.clearAllMocks();
    });

    it("tworzy mala pule ze skonczona kolejka, timeoutem i bezpiecznymi BIGINT", () => {
        getDbPool();
        expect(createPool).toHaveBeenCalledWith(expect.objectContaining({
            connectionLimit: 3,
            waitForConnections: true,
            queueLimit: 12,
            connectTimeout: 5000,
            supportBigNumbers: true,
            bigNumberStrings: true,
        }));
        expect(getDbQueryTimeoutMs()).toBe(10000);
    });

    it("dokleja timeout do zapytania puli podanego jako string", async () => {
        await getDbPool().execute("SELECT 1", [7]);
        expect(execute).toHaveBeenCalledWith({ sql: "SELECT 1", timeout: 10000 }, [7]);
    });

    it("dokleja timeout do query puli", async () => {
        await getDbPool().query("SELECT 2");
        expect(query).toHaveBeenCalledWith({ sql: "SELECT 2", timeout: 10000 }, );
    });

    it("nie nadpisuje jawnego timeoutu podanego przez wywolujacego", async () => {
        await getDbPool().execute({ sql: "SELECT 3", timeout: 250 });
        expect(execute).toHaveBeenCalledWith({ sql: "SELECT 3", timeout: 250 });
    });

    it("obejmuje timeoutem takze zapytania na polaczeniu z getConnection", async () => {
        const connection = await getDbPool().getConnection();
        await connection.execute("SELECT 4", [1]);
        expect(connectionExecute).toHaveBeenCalledWith({ sql: "SELECT 4", timeout: 10000 }, [1]);
    });

    it("zachowuje pozostale metody polaczenia", async () => {
        const connection = await getDbPool().getConnection();
        connection.release();
        expect(release).toHaveBeenCalledTimes(1);
    });

    it("zwraca ta sama instancje przy kolejnych wywolaniach", () => {
        expect(getDbPool()).toBe(getDbPool());
        expect(createPool).toHaveBeenCalledTimes(1);
    });
});
