import type { HlsConfig } from "hls.js";

export const HLS_MAX_BUFFER_LENGTH_SECONDS = 30;
export const HLS_MAX_MAX_BUFFER_LENGTH_SECONDS = 120;

export const buildHlsConfig = (startPositionSeconds: number): Partial<HlsConfig> => ({
    startPosition: startPositionSeconds,
    maxBufferLength: HLS_MAX_BUFFER_LENGTH_SECONDS,
    maxMaxBufferLength: HLS_MAX_MAX_BUFFER_LENGTH_SECONDS,
    capLevelToPlayerSize: true,
    startLevel: -1,
    xhrSetup: (xhr) => {
        xhr.withCredentials = false;
    },
});
