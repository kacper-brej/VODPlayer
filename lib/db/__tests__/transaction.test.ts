import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolConnection } from "mysql2/promise";
import { withTransaction } from "../transaction";
import { DatabaseError } from "../errors";

const createFakeConnection = () => ({
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
});

const createFakePool = (connection: ReturnType<typeof createFakeConnection>) =>
    ({
        getConnection: vi.fn().mockResolvedValue(connection),
    }) as unknown as Pool;

describe("withTransaction", () => {
    it("commit + release przy sukcesie, rollback nigdy wywołany", async () => {
        const connection = createFakeConnection();
        const pool = createFakePool(connection);

        const result = await withTransaction(async (conn) => {
            expect(conn).toBe(connection);
            return "ok";
        }, pool);

        expect(result).toBe("ok");
        expect(connection.beginTransaction).toHaveBeenCalledOnce();
        expect(connection.commit).toHaveBeenCalledOnce();
        expect(connection.rollback).not.toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalledOnce();
    });

    it("rollback + release przy błędzie w work(), connection zawsze zwolniona", async () => {
        const connection = createFakeConnection();
        const pool = createFakePool(connection);

        await expect(
            withTransaction(async () => {
                throw { code: "ER_DUP_ENTRY", errno: 1062 };
            }, pool),
        ).rejects.toBeInstanceOf(DatabaseError);

        expect(connection.commit).not.toHaveBeenCalled();
        expect(connection.rollback).toHaveBeenCalledOnce();
        expect(connection.release).toHaveBeenCalledOnce();
    });

    it("release() wywołane nawet gdy rollback() też rzuci wyjątek", async () => {
        const connection = createFakeConnection();
        connection.rollback.mockRejectedValueOnce(new Error("rollback failed"));
        const pool = createFakePool(connection);

        await expect(
            withTransaction(async () => {
                throw new Error("praca się nie powiodła");
            }, pool),
        ).rejects.toBeInstanceOf(DatabaseError);

        expect(connection.release).toHaveBeenCalledOnce();
    });

    it("work() dostaje dokładnie to połączenie, które zwróciło pool.getConnection()", async () => {
        const connection = createFakeConnection();
        const pool = createFakePool(connection);
        let received: PoolConnection | undefined;

        await withTransaction(async (conn) => {
            received = conn;
        }, pool);

        expect(received).toBe(connection);
    });

    it("mapuje blad pobrania polaczenia zanim rozpocznie transakcje", async () => {
        const pool = {
            getConnection: vi.fn().mockRejectedValue({ code: "POOL_ENQUEUELIMIT" }),
        } as unknown as Pool;
        await expect(withTransaction(async () => undefined, pool)).rejects.toMatchObject({
            code: "db_busy",
            httpStatus: 503,
        });
    });
});
