import "server-only";
import type { PoolConnection } from "mysql2/promise";
import { withTransaction } from "@/lib/db/transaction";
import { DatabaseError } from "@/lib/db/errors";
import { getViewerSeriesAccessLevel } from "@/lib/access/entitlements";
import { getDemoAsset } from "@/lib/access/demoAsset";
import { parseVirtualEpisodeKey, parseVirtualTmdbRef } from "@/lib/catalog/tmdbVirtualSeries";
import type { ResumePoint, EpisodeProgress, SeriesResumePoint } from "@/lib/core/contracts";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import { isEpisodeComplete } from "@/lib/progress/watchProgress";
import * as repo from "@/lib/progress/progressRepository";

const PLAY_COUNT_THRESHOLD_SECONDS = 120;
const MAX_SECONDS = 24 * 60 * 60 * 10;
const MAX_KEY_LENGTH = 255;

export interface ProgressReadModel { episodesBySeries: Record<string, Record<string, EpisodeProgress>>; resumes: ResumePoint[] }

export const getProgressSnapshot = async (userId: number, username: string, seriesKeys?: readonly string[]): Promise<ProgressReadModel> => {
    const profileId = await resolveOwnedProfileId(userId, username);
    return repo.loadProgressSnapshot(profileId, seriesKeys);
};

export const getContinueWatching = async (userId: number, username: string): Promise<ResumePoint[]> =>
    (await getProgressSnapshot(userId, username)).resumes;

export interface SeriesProgress { seriesKey: string; episodes: Record<string, EpisodeProgress>; resume: SeriesResumePoint | null }

export const getSeriesProgress = async (userId: number, username: string, seriesKey: string): Promise<SeriesProgress | null> => {
    if (!seriesKey || seriesKey.length > MAX_KEY_LENGTH) return null;
    const snapshot = await getProgressSnapshot(userId, username, [seriesKey]);
    const resume = snapshot.resumes.find((item) => item.seriesKey === seriesKey) ?? null;
    return {
        seriesKey,
        episodes: snapshot.episodesBySeries[seriesKey] ?? {},
        resume: resume ? { episodeKey: resume.episodeKey, positionSeconds: resume.positionSeconds, durationSeconds: resume.durationSeconds } : null,
    };
};

const isFiniteNonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
export type SaveProgressResult = { ok: true; completed: boolean } | { ok: false; code: "invalid" | "unavailable" | "server" };

const isValidVirtualDemoTarget = (seriesKey: string, episodeKey: string): boolean => {
    const series = parseVirtualTmdbRef(seriesKey);
    const episode = parseVirtualEpisodeKey(episodeKey);
    if (!series || !episode) return false;

    return series.kind === "tv" || (episode.season === 1 && episode.episode === 1);
};

const resolvePersistedAsset = async (
    seriesKey: string,
    episodeKey: string,
    connection: PoolConnection,
): Promise<repo.ReadyMediaAsset | null> => {
    const virtualDemoTarget = isValidVirtualDemoTarget(seriesKey, episodeKey);
    const episode = virtualDemoTarget
        ? null
        : await repo.findReadyMediaAsset(seriesKey, episodeKey, connection);

    if (!virtualDemoTarget) {
        if (!episode) return null;
        if (await getViewerSeriesAccessLevel(seriesKey) === "full") return episode;
    }

    const demo = await getDemoAsset();
    if (!demo || demo.durationSeconds === null) return null;

    return {
        id: demo.assetId,
        version: demo.assetVersion,
        seriesKey: episode?.seriesKey ?? seriesKey,
        episodeKey: episode?.episodeKey ?? episodeKey,
        durationSeconds: demo.durationSeconds,
    };
};

export const saveProgress = async (
    userId: number, username: string, input: { series: string; episode: string; position: unknown },
): Promise<SaveProgressResult> => {
    const seriesKey = input.series.trim();
    const episodeKey = input.episode.trim();
    if (!seriesKey || !episodeKey || seriesKey.length > MAX_KEY_LENGTH || episodeKey.length > MAX_KEY_LENGTH) return { ok: false, code: "invalid" };
    if (!isFiniteNonNegative(input.position) || input.position > MAX_SECONDS) return { ok: false, code: "invalid" };
    const requestedPosition = input.position;
    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        const outcome = await withTransaction(async (connection) => {
            const asset = await resolvePersistedAsset(seriesKey, episodeKey, connection);
            if (!asset) return null;
            const position = Math.min(Math.round(requestedPosition), asset.durationSeconds);
            const completed = await repo.upsertWatchProgress(profileId, asset, position, isEpisodeComplete(position, asset.durationSeconds), connection);
            if (position >= PLAY_COUNT_THRESHOLD_SECONDS) {
                const countedToday = await repo.markPlayCountedToday(profileId, asset.seriesKey, asset.episodeKey, connection);
                if (countedToday) await repo.incrementWeeklyPlayCount(asset.seriesKey, connection);
            }
            return { completed };
        });
        return outcome ? { ok: true, completed: outcome.completed } : { ok: false, code: "unavailable" };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type ResetProgressResult = { ok: true } | { ok: false; code: "invalid" | "unavailable" | "server" };

export const resetProgressForRewatch = async (
    userId: number, username: string, seriesKey: string, episodeKey: string,
): Promise<ResetProgressResult> => {
    if (!seriesKey || !episodeKey || seriesKey.length > MAX_KEY_LENGTH || episodeKey.length > MAX_KEY_LENGTH) {
        return { ok: false, code: "invalid" };
    }
    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        const reset = await withTransaction(async (connection) => {
            const asset = await repo.findReadyMediaAsset(seriesKey, episodeKey, connection);
            if (!asset) return false;
            await repo.resetWatchProgressForRewatch(profileId, asset.seriesKey, asset.episodeKey, connection);
            return true;
        });
        return reset ? { ok: true } : { ok: false, code: "unavailable" };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
