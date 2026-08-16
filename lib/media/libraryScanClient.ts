import "server-only";
import { fileStreamOrigin } from "@/lib/player/fileOrigin";
import { LIBRARY_SCAN_URL_TTL_SECONDS, signLibraryScanRequest } from "@/lib/media/libraryScanSigning";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_SERIES = 500;
const MAX_EPISODES_PER_SERIES = 2000;

export interface ScannedEpisode {
    episodeKey: string;
    sizeBytes: number;
    previewClipKey: string | null;
}

export interface ScannedSeries {
    seriesKey: string;
    episodes: ScannedEpisode[];
}

export type LibraryScanResult =
    | { ok: true; series: ScannedSeries[] }
    | { ok: false; code: "unconfigured" | "unreachable" | "rejected" | "malformed" };

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

// Ten sam warunek co isSafeLibrarySegment po stronie PHP: bez separatorow
// sciezki, bez kropki na poczatku, bez bajtu zerowego. Nazwy ze spacjami
// i spoza ASCII sa poprawne i musza przejsc.
const isSafeSegment = (value: unknown): value is string =>
    typeof value === "string"
    && value !== ""
    && value.length <= 255
    && !value.startsWith(".")
    && !value.includes("/")
    && !value.includes("\\")
    && !value.includes("\0");

const readEpisode = (value: unknown): ScannedEpisode | null => {
    if (!isObject(value) || !isSafeSegment(value.episodeKey)) return null;
    if (!/\.mp4$/iu.test(value.episodeKey)) return null;
    const sizeBytes = typeof value.sizeBytes === "number" && Number.isFinite(value.sizeBytes)
        ? Math.max(0, Math.trunc(value.sizeBytes))
        : 0;
    const previewClipKey = isSafeSegment(value.previewClipKey)
        && /\.preview\.mp4$/iu.test(value.previewClipKey)
        ? value.previewClipKey
        : null;
    return { episodeKey: value.episodeKey, sizeBytes, previewClipKey };
};

const readSeries = (value: unknown): ScannedSeries | null => {
    if (!isObject(value) || !isSafeSegment(value.seriesKey) || !Array.isArray(value.episodes)) return null;
    const episodes = value.episodes
        .slice(0, MAX_EPISODES_PER_SERIES)
        .map(readEpisode)
        .filter((episode): episode is ScannedEpisode => episode !== null);
    return episodes.length === 0 ? null : { seriesKey: value.seriesKey, episodes };
};

export const scanFileLibrary = async (): Promise<LibraryScanResult> => {
    let origin: string;
    try {
        origin = fileStreamOrigin();
    } catch {
        return { ok: false, code: "unconfigured" };
    }

    const expiresAt = Math.floor(Date.now() / 1000) + LIBRARY_SCAN_URL_TTL_SECONDS;
    const query = new URLSearchParams({
        exp: String(expiresAt),
        sig: signLibraryScanRequest(expiresAt),
    });

    let response: Response;
    try {
        response = await fetch(`${origin}/library-scan.php?${query.toString()}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch {
        return { ok: false, code: "unreachable" };
    }

    if (!response.ok) return { ok: false, code: "rejected" };

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        return { ok: false, code: "malformed" };
    }

    if (!isObject(payload) || !Array.isArray(payload.series)) return { ok: false, code: "malformed" };

    return {
        ok: true,
        series: payload.series
            .slice(0, MAX_SERIES)
            .map(readSeries)
            .filter((series): series is ScannedSeries => series !== null),
    };
};
