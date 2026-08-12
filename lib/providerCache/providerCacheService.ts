import "server-only";
import { createHash } from "node:crypto";
import { DatabaseError } from "@/lib/db/errors";
import * as repo from "@/lib/providerCache/providerCacheRepository";

const MAX_PROVIDER_LENGTH = 16;
const MAX_PATH_LENGTH = 512;

const cacheKeyFor = (path: string): string => createHash("sha256").update(path).digest("hex");

export interface CachedResponse {
    data: unknown;
    fetchedAtMs: number;
}

export const getCachedResponse = async (provider: string, path: string): Promise<CachedResponse | null> => {
    const normalizedProvider = provider.trim();
    if (normalizedProvider === "" || normalizedProvider.length > MAX_PROVIDER_LENGTH) return null;
    if (path === "" || path.length > MAX_PATH_LENGTH) return null;

    try {
        const row = await repo.getCachedResponse(normalizedProvider, cacheKeyFor(path));
        if (!row) return null;

        let data: unknown;
        try {
            data = JSON.parse(row.responseJson);
        } catch (error) {
            console.error(`providerCache[${normalizedProvider}]: uszkodzony wpis w bazie, ignoruje jak brak`, error);
            return null;
        }

        return { data, fetchedAtMs: Date.now() - row.ageSeconds * 1000 };
    } catch (error) {
        if (error instanceof DatabaseError) {
            console.error("providerCache read failed:", error);
            return null;
        }
        throw error;
    }
};

export type SetCachedResponseResult = { ok: true } | { ok: false; code: "invalid" | "server" };

export const setCachedResponse = async (
    provider: string,
    path: string,
    data: unknown,
): Promise<SetCachedResponseResult> => {
    const normalizedProvider = provider.trim();
    if (normalizedProvider === "" || normalizedProvider.length > MAX_PROVIDER_LENGTH) return { ok: false, code: "invalid" };
    if (path === "" || path.length > MAX_PATH_LENGTH) return { ok: false, code: "invalid" };

    let responseJson: string | undefined;
    try {
        responseJson = JSON.stringify(data);
    } catch {
        responseJson = undefined;
    }
    if (responseJson === undefined) return { ok: false, code: "invalid" };

    try {
        await repo.upsertCachedResponse(
            normalizedProvider,
            cacheKeyFor(path),
            path.slice(0, MAX_PATH_LENGTH),
            responseJson,
        );
        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
