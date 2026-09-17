import type { MetricName } from "./contracts";

export const createPlaybackMeasurements = (
    report: (name: MetricName, value: number) => void,
    now = () => performance.now(),
) => {
    let startup: number | null = null;
    let seek: number | null = null;
    let buffer: number | null = null;
    let started = false;
    let playing = false;
    let visible = true;
    let failed = false;
    const elapsed = (name: MetricName, since: number | null) => {
        if (since === null) return;
        const value = now() - since;
        if (value >= 0 && value <= 600_000) report(name, value);
    };
    const interrupt = () => { startup = null; seek = null; buffer = null; playing = false; };
    return {
        requestPlay(at = now()) {
            if (!started && visible && startup === null) startup = at;
        },
        firstFrame() {
            if (!visible) return;
            if (!started) elapsed("PLAYER_STARTUP", startup);
            started = true;
            startup = null;
            failed = false;
            playing = true;
            elapsed("PLAYER_BUFFER", buffer);
            buffer = null;
        },
        waiting() {
            if (started && playing && visible && seek === null && buffer === null) buffer = now();
        },
        seeking() {
            buffer = null;
            if (started && visible && seek === null) seek = now();
        },
        seeked() {
            elapsed("PLAYER_SEEK", seek);
            seek = null;
        },
        pause: interrupt,
        error() {
            if (!failed && visible) report("PLAYER_ERROR", 1);
            failed = true;
            interrupt();
        },
        visibility(next: boolean) {
            visible = next;
            if (!next) interrupt();
        },
        dispose: interrupt,
    };
};
