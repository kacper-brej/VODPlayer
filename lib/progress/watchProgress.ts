export const ASSUMED_EPISODE_DURATION_SECONDS = 24 * 60;
export const WATCHED_THRESHOLD_PERCENT = 90;
export const COMPLETION_END_MARGIN_SECONDS = 60;

export const secondsToProgressPercent = (seconds: number) =>
    Math.min(100, Math.round((seconds / ASSUMED_EPISODE_DURATION_SECONDS) * 100));

export const progressPercent = (positionSeconds: number, durationSeconds?: number | null) => {
    if (!positionSeconds || positionSeconds <= 0) return 0;

    const total = durationSeconds && durationSeconds > 0 ? durationSeconds : ASSUMED_EPISODE_DURATION_SECONDS;

    return Math.min(100, Math.round((positionSeconds / total) * 100));
};

export const isWatched = (positionSeconds: number, durationSeconds?: number | null) =>
    progressPercent(positionSeconds, durationSeconds) >= WATCHED_THRESHOLD_PERCENT;

export const isEpisodeComplete = (positionSeconds: number, durationSeconds: number): boolean => {
    if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
    const clampedPosition = Math.max(0, Math.min(positionSeconds, durationSeconds));
    const endMargin = Math.min(COMPLETION_END_MARGIN_SECONDS, durationSeconds * 0.1);
    return clampedPosition >= durationSeconds * (WATCHED_THRESHOLD_PERCENT / 100)
        || durationSeconds - clampedPosition <= endMargin;
};
