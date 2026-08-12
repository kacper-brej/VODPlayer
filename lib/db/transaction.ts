import "server-only";
import type { Pool, PoolConnection } from "mysql2/promise";
import { getDbPool } from "./pool";
import { mapDatabaseError } from "./errors";
import { observeDbOperation } from "./metrics";

export const withTransaction = async <T>(
    work: (connection: PoolConnection) => Promise<T>,
    pool: Pool = getDbPool(),
): Promise<T> => {
    let connection: PoolConnection;
    try {
        connection = await observeDbOperation("transaction.acquire", () => pool.getConnection());
    } catch (error) {
        throw mapDatabaseError(error);
    }
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("withTransaction: rollback też się nie powiódł", rollbackError);
        }
        throw mapDatabaseError(error);
    } finally {
        connection.release();
    }
};
