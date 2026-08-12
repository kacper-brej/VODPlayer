import "server-only";

export const ARTWORK_MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const ARTWORK_MAX_INPUT_PIXELS = 40_000_000;
export const ARTWORK_FETCH_TIMEOUT_MS = 8_000;
export const ARTWORK_MAX_REDIRECTS = 3;

const ALLOWED_REMOTE_HOSTS = new Set([
    "image.tmdb.org",
    "s4.anilist.co",
    "cdn.myanimelist.net",
    "img.youtube.com",
    "i.ytimg.com",
]);

export type ArtworkValidationErrorCode =
    | "empty_input"
    | "input_too_large"
    | "unsafe_url"
    | "too_many_redirects"
    | "download_failed";

export class ArtworkValidationError extends Error {
    constructor(public readonly code: ArtworkValidationErrorCode) {
        super(code);
        this.name = "ArtworkValidationError";
    }
}

export const assertArtworkInputSize = (
    byteLength: number,
    maxBytes = ARTWORK_MAX_INPUT_BYTES,
): void => {
    const effectiveMax = Math.min(maxBytes, ARTWORK_MAX_INPUT_BYTES);

    if (byteLength < 1) throw new ArtworkValidationError("empty_input");
    if (byteLength > effectiveMax) throw new ArtworkValidationError("input_too_large");
};

export const validateArtworkSourceUrl = (value: string | URL): URL => {
    let url: URL;

    try {
        url = value instanceof URL ? new URL(value.href) : new URL(value);
    } catch {
        throw new ArtworkValidationError("unsafe_url");
    }

    const hostname = url.hostname.toLowerCase();
    if (
        url.protocol !== "https:"
        || url.username !== ""
        || url.password !== ""
        || url.port !== ""
        || !ALLOWED_REMOTE_HOSTS.has(hostname)
    ) {
        throw new ArtworkValidationError("unsafe_url");
    }

    return url;
};

const parseContentLength = (value: string | null): number | null => {
    if (value === null || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
};

const readLimitedBody = async (response: Response, maxBytes: number): Promise<Buffer> => {
    if (!response.body) throw new ArtworkValidationError("download_failed");

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                throw new ArtworkValidationError("input_too_large");
            }
            chunks.push(Buffer.from(value));
        }
    } finally {
        reader.releaseLock();
    }

    const result = Buffer.concat(chunks, total);
    assertArtworkInputSize(result.byteLength, maxBytes);
    return result;
};

export interface DownloadArtworkOptions {
    fetchImplementation?: typeof fetch;
    maxBytes?: number;
    timeoutMs?: number;
    maxRedirects?: number;
}

export const downloadArtwork = async (
    source: string | URL,
    options: DownloadArtworkOptions = {},
): Promise<Buffer> => {
    const fetchImplementation = options.fetchImplementation ?? fetch;
    const maxBytes = Math.min(options.maxBytes ?? ARTWORK_MAX_INPUT_BYTES, ARTWORK_MAX_INPUT_BYTES);
    const timeoutMs = options.timeoutMs ?? ARTWORK_FETCH_TIMEOUT_MS;
    const maxRedirects = Math.min(options.maxRedirects ?? ARTWORK_MAX_REDIRECTS, ARTWORK_MAX_REDIRECTS);
    let currentUrl = validateArtworkSourceUrl(source);

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
        let response: Response;

        try {
            response = await fetchImplementation(currentUrl, {
                cache: "no-store",
                redirect: "manual",
                signal: AbortSignal.timeout(timeoutMs),
                headers: { Accept: "image/jpeg, image/png, image/webp" },
            });
        } catch (error) {
            if (error instanceof ArtworkValidationError) throw error;
            throw new ArtworkValidationError("download_failed");
        }

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location) throw new ArtworkValidationError("download_failed");
            if (redirectCount === maxRedirects) {
                throw new ArtworkValidationError("too_many_redirects");
            }
            currentUrl = validateArtworkSourceUrl(new URL(location, currentUrl));
            continue;
        }

        if (!response.ok) throw new ArtworkValidationError("download_failed");

        const contentLength = parseContentLength(response.headers.get("content-length"));
        if (contentLength !== null && contentLength > maxBytes) {
            throw new ArtworkValidationError("input_too_large");
        }

        return readLimitedBody(response, maxBytes);
    }

    throw new ArtworkValidationError("too_many_redirects");
};
