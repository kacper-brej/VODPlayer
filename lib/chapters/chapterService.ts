import "server-only";
import { withTransaction } from "@/lib/db/transaction";
import { DatabaseError } from "@/lib/db/errors";
import { getCatalogSeriesByKey } from "@/lib/catalog/catalog";
import type { EpisodeChapter, EpisodeChapterType } from "@/lib/core/contracts";
import * as repo from "@/lib/chapters/chapterRepository";
import type { ChapterRow, SeriesChapterDefaults } from "@/lib/chapters/chapterRepository";

const CHAPTER_TYPES: EpisodeChapterType[] = ["intro", "outro", "recap"];
const MAX_SECONDS = 2147483647;
const MAX_KEY_LENGTH = 255;

const validateLibraryKey = (raw: string): string | null => {
    const key = raw.trim();
    if (
        key === ""
        || key.length > MAX_KEY_LENGTH
        || key === "."
        || key === ".."
        || key.includes("/")
        || key.includes("\\")
        || key.includes("\0")
    ) {
        return null;
    }
    return key;
};

const isChapterType = (value: unknown): value is EpisodeChapterType =>
    value === "intro" || value === "outro" || value === "recap";

const isValidSecond = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SECONDS;

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
    aStart < bEnd && bStart < aEnd;

const activeChaptersForEpisode = (
    explicitRows: ChapterRow[],
    defaults: SeriesChapterDefaults,
    durationSeconds: number | undefined,
): EpisodeChapter[] => {
    const byType = new Map<EpisodeChapterType, EpisodeChapter>();

    for (const row of explicitRows) {
        byType.set(row.type, { type: row.type, startSeconds: row.startSeconds, endSeconds: row.endSeconds });
    }

    for (const type of CHAPTER_TYPES) {
        if (byType.has(type)) continue;
        const fallback = defaults[type];
        if (!fallback) continue;

        if (durationSeconds !== undefined) {
            if (fallback.startSeconds >= durationSeconds) continue;
            byType.set(type, { type, startSeconds: fallback.startSeconds, endSeconds: Math.min(fallback.endSeconds, durationSeconds) });
        } else {
            byType.set(type, { type, startSeconds: fallback.startSeconds, endSeconds: fallback.endSeconds });
        }
    }

    return [...byType.values()].sort((a, b) => a.startSeconds - b.startSeconds);
};

export const getEpisodeChapters = async (seriesKey: string, episodeKey: string): Promise<EpisodeChapter[]> => {
    const [rows, defaults, durations] = await Promise.all([
        repo.listEpisodeChaptersForEpisodes(seriesKey, [episodeKey]),
        repo.listSeriesChapterDefaults(seriesKey),
        repo.listEpisodeDurations(seriesKey, [episodeKey]),
    ]);

    return activeChaptersForEpisode(rows, defaults, durations[episodeKey]);
};

const resolveSeriesEpisodeKeys = async (seriesKey: string, currentEpisodeKey: string): Promise<string[]> => {
    const catalogResult = await getCatalogSeriesByKey(seriesKey);
    const catalogKeys = catalogResult.kind === "error" || catalogResult.data === null
        ? []
        : catalogResult.data.episodes.map((episode) => episode.key);

    return [...new Set([...catalogKeys, currentEpisodeKey])];
};

const groupByEpisode = (rows: ChapterRow[]): Map<string, ChapterRow[]> => {
    const grouped = new Map<string, ChapterRow[]>();
    for (const row of rows) {
        const bucket = grouped.get(row.episodeKey);
        if (bucket) bucket.push(row);
        else grouped.set(row.episodeKey, [row]);
    }
    return grouped;
};

export type SaveChapterResult =
    | { ok: true; affectedEpisodes: number; chapter: { startSeconds: number; endSeconds: number; type: EpisodeChapterType } }
    | { ok: false; code: "invalid" | "overlap" | "server" };

export const saveChapter = async (
    rawSeriesKey: string,
    rawEpisodeKey: string,
    rawType: unknown,
    rawStartSeconds: unknown,
    rawEndSeconds: unknown,
    applyToSeries: boolean,
): Promise<SaveChapterResult> => {
    const seriesKey = validateLibraryKey(rawSeriesKey);
    const episodeKey = validateLibraryKey(rawEpisodeKey);

    if (
        seriesKey === null
        || episodeKey === null
        || !isChapterType(rawType)
        || !isValidSecond(rawStartSeconds)
        || !isValidSecond(rawEndSeconds)
        || rawStartSeconds >= rawEndSeconds
    ) {
        return { ok: false, code: "invalid" };
    }

    const type = rawType;
    const startSeconds = rawStartSeconds;
    const endSeconds = rawEndSeconds;

    try {
        const episodeKeys = applyToSeries ? await resolveSeriesEpisodeKeys(seriesKey, episodeKey) : [episodeKey];
        const durations = await repo.listEpisodeDurations(seriesKey, episodeKeys);

        for (const key of episodeKeys) {
            const duration = durations[key];
            if (duration !== undefined && endSeconds > duration) return { ok: false, code: "invalid" };
        }

        const [rows, defaults] = await Promise.all([
            repo.listEpisodeChaptersForEpisodes(seriesKey, episodeKeys),
            repo.listSeriesChapterDefaults(seriesKey),
        ]);
        const rowsByEpisode = groupByEpisode(rows);

        for (const key of episodeKeys) {
            const active = activeChaptersForEpisode(rowsByEpisode.get(key) ?? [], defaults, durations[key]);
            const overlaps = active.some(
                (chapter) => chapter.type !== type && rangesOverlap(startSeconds, endSeconds, chapter.startSeconds, chapter.endSeconds),
            );
            if (overlaps) return { ok: false, code: "overlap" };
        }

        await withTransaction(async (connection) => {
            if (applyToSeries) {
                await repo.upsertSeriesChapterDefault(seriesKey, type, startSeconds, endSeconds, connection);
            }

            for (const key of episodeKeys) {
                if (applyToSeries) {
                    await repo.upsertEpisodeChapterInherited(seriesKey, key, type, startSeconds, endSeconds, connection);
                } else {
                    await repo.upsertEpisodeChapterManual(seriesKey, key, type, startSeconds, endSeconds, connection);
                }
            }
        });

        return { ok: true, affectedEpisodes: episodeKeys.length, chapter: { startSeconds, endSeconds, type } };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type DeleteChapterResult = { ok: true; deleted: number } | { ok: false; code: "invalid" | "server" };

export const deleteChapter = async (
    rawSeriesKey: string,
    rawEpisodeKey: string,
    rawType: unknown,
): Promise<DeleteChapterResult> => {
    const seriesKey = validateLibraryKey(rawSeriesKey);
    const episodeKey = validateLibraryKey(rawEpisodeKey);

    if (seriesKey === null || episodeKey === null || !isChapterType(rawType)) {
        return { ok: false, code: "invalid" };
    }

    try {
        const deleted = await repo.deleteEpisodeChapter(seriesKey, episodeKey, rawType);
        return { ok: true, deleted };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
