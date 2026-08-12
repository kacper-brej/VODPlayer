import "server-only";
import { createHash } from "node:crypto";
import type { Pool, PoolConnection } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";

type Executor = Pool | PoolConnection;
declare global { var __nocturnaMediaNonceCleanupAt: number | undefined }
const isDuplicateKey = (error: unknown): boolean => typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";

export const consumeMediaRequestNonce = async (nonce: string, expiresAtEpochSeconds: number, db: Executor = getDbPool()): Promise<boolean> => {
    const nonceHash = createHash("sha256").update(nonce).digest("hex");
    try {
        await db.execute(
            `INSERT INTO media_request_nonces (nonce_hash, expires_at) VALUES (?, FROM_UNIXTIME(?))`,
            [nonceHash, expiresAtEpochSeconds],
        );
        const now = Date.now();
        if (now - (globalThis.__nocturnaMediaNonceCleanupAt ?? 0) > 60 * 60 * 1000) {
            globalThis.__nocturnaMediaNonceCleanupAt = now;
            await db.execute("DELETE FROM media_request_nonces WHERE expires_at < CURRENT_TIMESTAMP(6) LIMIT 500")
                .catch((error: unknown) => console.error("media nonce cleanup failed", error));
        }
        return true;
    } catch (error) {
        if (isDuplicateKey(error)) return false;
        throw error;
    }
};

export const deleteExpiredMediaRequestNonces = async (limit = 500, db: Executor = getDbPool()): Promise<void> => {
    const safeLimit = Math.max(1, Math.min(5_000, Math.trunc(limit)));
    await db.execute(`DELETE FROM media_request_nonces WHERE expires_at < CURRENT_TIMESTAMP(6) LIMIT ${safeLimit}`);
};
