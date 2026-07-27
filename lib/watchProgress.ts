export const ASSUMED_EPISODE_DURATION_SECONDS = 24 * 60;
export const WATCHED_THRESHOLD_PERCENT = 90;

export const secondsToProgressPercent = (seconds: number) =>
    Math.min(100, Math.round((seconds / ASSUMED_EPISODE_DURATION_SECONDS) * 100));

export const progressPercent = (positionSeconds: number, durationSeconds?: number | null) => {
    if (!positionSeconds || positionSeconds <= 0) return 0;

    const total = durationSeconds && durationSeconds > 0 ? durationSeconds : ASSUMED_EPISODE_DURATION_SECONDS;

    return Math.min(100, Math.round((positionSeconds / total) * 100));
};

export const isWatched = (positionSeconds: number, durationSeconds?: number | null) =>
    progressPercent(positionSeconds, durationSeconds) >= WATCHED_THRESHOLD_PERCENT;
