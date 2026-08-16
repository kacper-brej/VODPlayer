import "server-only";
import {
    createRateLimitedClient,
    type RateLimitedRequestConfig,
} from "@/lib/metadata/rateLimitedClient";
import { validateTmdbConfigurationResponse } from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const CONFIG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let missingTokenWarned = false;
let cachedImageBaseUrl: { value: string; expiresAt: number } | null = null;

const client = createRateLimitedClient({
    providerId: "tmdb",
    baseUrl: TMDB_BASE_URL,
    minRequestIntervalMs: 25,
    cacheTtlMs: 60 * 60 * 1000,
    cacheMaxEntries: 256,
    maxRetries: 3,
});

export const tmdbToken = (): string | null => {
    const token = process.env.TMDB_READ_TOKEN;

    if (!token) {
        if (!missingTokenWarned) {
            missingTokenWarned = true;
            console.error("TMDB_READ_TOKEN is not configured - TMDB enrichment is disabled.");
        }
        return null;
    }

    return token;
};

export const fetchTmdbResult = async (
    path: string,
    validator: (value: unknown) => boolean,
    requestConfig?: RateLimitedRequestConfig,
): Promise<DataResult<unknown>> => {
    const token = tmdbToken();
    if (!token) return dataFailure("not_configured");

    return client.fetchResult(
        path,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        validator,
        requestConfig,
    );
};

export const getTmdbImageBaseUrl = async (): Promise<DataResult<string>> => {
    if (cachedImageBaseUrl && cachedImageBaseUrl.expiresAt > Date.now()) {
        return dataSuccess(cachedImageBaseUrl.value);
    }

    const response = await fetchTmdbResult(
        "/configuration",
        (value) => validateTmdbConfigurationResponse(value).ok,
    );
    if (response.kind === "error") return response;

    const result = validateTmdbConfigurationResponse(response.data);
    if (!result.ok) return dataFailure("invalid_response");

    const baseUrl = result.data.images.secure_base_url;
    cachedImageBaseUrl = { value: baseUrl, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS };

    return dataSuccess(baseUrl);
};

export const buildTmdbImageUrl = (baseUrl: string, size: string, filePath: string): string =>
    `${baseUrl}${size}${filePath}`;
