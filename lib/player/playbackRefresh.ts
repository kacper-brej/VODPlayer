export const HLS_REFRESH_MAX_ATTEMPTS = 3;
export const HLS_REFRESH_BACKOFF_MS = [0, 400, 1200] as const;

export interface PlaybackRefreshSnapshot {
    positionSeconds: number;
    paused: boolean;
    qualityHeight: number | null;
}

export const playbackRefreshSnapshot = (
    positionSeconds: number,
    paused: boolean,
    qualityHeight: number | null,
): PlaybackRefreshSnapshot => ({
    positionSeconds: Number.isFinite(positionSeconds) ? Math.max(0, positionSeconds) : 0,
    paused,
    qualityHeight: Number.isFinite(qualityHeight) && qualityHeight! > 0 ? qualityHeight : null,
});

export const shouldRefreshHlsAccess = (
    fatal: boolean,
    statusCode: number | undefined,
    attempts: number,
): boolean => fatal
    && (statusCode === 403 || statusCode === 410)
    && attempts < HLS_REFRESH_MAX_ATTEMPTS;
