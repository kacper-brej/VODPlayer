
export const ASSUMED_EPISODE_DURATION_SECONDS = 24 * 60;
export const WATCHED_THRESHOLD_PERCENT = 90;

export const secondsToProgressPercent = (seconds: number) =>
    Math.min(100, Math.round((seconds / ASSUMED_EPISODE_DURATION_SECONDS) * 100));
