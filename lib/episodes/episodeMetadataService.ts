import "server-only";

import { DatabaseError } from "@/lib/db/errors";
import * as repository from "@/lib/episodes/episodeMetadataRepository";
import type {
    EpisodeMetadataPatch,
    EpisodeMetadataRecord,
    ThumbnailSource,
} from "@/lib/episodes/episodeMetadataRepository";

export type { EpisodeMetadataPatch, ThumbnailSource } from "@/lib/episodes/episodeMetadataRepository";

const MAX_KEY_LENGTH = 255;
const MAX_DURATION_SECONDS = 86_400;

export interface EpisodeBackfillSeries {
    key: string;
    title: string;
    seasonNumber: number | null;
    episodes: Array<{
        key: string;
        number: number;
        title: string | null;
        synopsis: string | null;
        thumbnailPath: string | null;
        thumbnailSource: ThumbnailSource | null;
    }>;
}

export type EpisodeMetadataResult<T> =
    | { ok: true; data: T }
    | { ok: false; code: "invalid" | "not_found" | "server" };

const objectValue = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const seriesKey = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const key = value.trim();
    if (
        key === ""
        || key.length > MAX_KEY_LENGTH
        || key.startsWith(".")
        || /[\x00-\x1f\x7f/\\]/u.test(key)
    ) return null;
    return key;
};

const episodeKey = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const key = value.trim();
    return key.length <= MAX_KEY_LENGTH && /^[^./\\]+\.mp4$/iu.test(key) ? key : null;
};

const optionalText = (
    payload: Record<string, unknown>,
    field: "title" | "synopsis",
    maxLength?: number,
): { valid: true; value?: string | null } | { valid: false } => {
    if (!(field in payload)) return { valid: true };
    const raw = payload[field];
    if (raw !== null && typeof raw !== "string") return { valid: false };
    const value = raw === null ? null : raw.trim() || null;
    if (value !== null && maxLength !== undefined && value.length > maxLength) return { valid: false };
    return { valid: true, value };
};

export const parseEpisodeMetadataPatch = (value: unknown): EpisodeMetadataPatch | null => {
    const payload = objectValue(value);
    if (!payload) return null;

    const parsedSeriesKey = seriesKey(payload.series ?? payload.seriesKey);
    const parsedEpisodeKey = episodeKey(payload.episode ?? payload.episodeKey);
    if (!parsedSeriesKey || !parsedEpisodeKey) return null;

    const title = optionalText(payload, "title", 255);
    const synopsis = optionalText(payload, "synopsis");
    if (!title.valid || !synopsis.valid) return null;

    let durationSeconds: number | null | undefined;
    if ("durationSeconds" in payload) {
        const raw = payload.durationSeconds;
        if (raw !== null && (
            typeof raw !== "number"
            || !Number.isSafeInteger(raw)
            || raw < 1
            || raw > MAX_DURATION_SECONDS
        )) return null;
        durationSeconds = raw as number | null;
    }

    let thumbnailPath: string | null | undefined;
    let thumbnailSource: ThumbnailSource | null | undefined;
    if ("thumbnailPath" in payload) {
        const rawPath = payload.thumbnailPath;
        if (rawPath !== null && typeof rawPath !== "string") return null;
        thumbnailPath = rawPath === null ? null : rawPath.trim() || null;
        if (thumbnailPath !== null && thumbnailPath.length > 255) return null;

        if (thumbnailPath === null) {
            thumbnailSource = null;
        } else if (payload.thumbnailSource === "local" || payload.thumbnailSource === "tmdb") {
            thumbnailSource = payload.thumbnailSource;
        } else {
            return null;
        }
    } else if ("thumbnailSource" in payload) {
        return null;
    }

    const patch: EpisodeMetadataPatch = {
        seriesKey: parsedSeriesKey,
        episodeKey: parsedEpisodeKey,
        ...(title.value !== undefined ? { title: title.value } : {}),
        ...(synopsis.value !== undefined ? { synopsis: synopsis.value } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        ...(thumbnailPath !== undefined ? { thumbnailPath, thumbnailSource } : {}),
    };

    if (
        patch.title === undefined
        && patch.synopsis === undefined
        && patch.durationSeconds === undefined
        && patch.thumbnailPath === undefined
    ) return null;

    return patch;
};

export const saveEpisodeMetadata = async (
    value: unknown,
): Promise<EpisodeMetadataResult<EpisodeMetadataRecord>> => {
    const patch = parseEpisodeMetadataPatch(value);
    if (!patch) return { ok: false, code: "invalid" };

    try {
        if (!(await repository.hasReadyMediaAsset(patch.seriesKey, patch.episodeKey))) {
            return { ok: false, code: "not_found" };
        }
        const saved = await repository.upsertEpisodeMetadata(patch);
        return saved ? { ok: true, data: saved } : { ok: false, code: "server" };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

const episodeNumber = (key: string): number => {
    const parsed = Number.parseInt(key.replace(/\.mp4$/iu, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const listEpisodeBackfillSeries = async (): Promise<EpisodeBackfillSeries[]> => {
    const rows = await repository.listReadyEpisodesForBackfill();
    const grouped = new Map<string, EpisodeBackfillSeries>();

    for (const row of rows) {
        let series = grouped.get(row.series_key);
        if (!series) {
            series = {
                key: row.series_key,
                title: row.series_key,
                seasonNumber: row.season_number,
                episodes: [],
            };
            grouped.set(row.series_key, series);
        }
        series.episodes.push({
            key: row.episode_key,
            number: episodeNumber(row.episode_key),
            title: row.title,
            synopsis: row.synopsis,
            thumbnailPath: row.thumbnail_path,
            thumbnailSource: row.thumbnail_source,
        });
    }

    return [...grouped.values()];
};
