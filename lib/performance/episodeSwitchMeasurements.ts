import { performanceSamplingEnabled, reportPerformanceSample } from "./client";
import type { PerformanceSample } from "./contracts";

type Report = (sample: Pick<PerformanceSample, "id" | "name" | "value" | "load"> & { delivery: "file" | "hls" }) => void;

export const createEpisodeSwitchMeasurement = (
    delivery: "file" | "hls",
    report: Report,
    now = () => performance.now(),
    id = crypto.randomUUID(),
) => {
    const startedAt = now();
    let cancelled = false;
    let ready = false;
    let load: PerformanceSample["load"];
    const emit: Report = (sample) => {
        // Diagnostics must never turn a successful navigation into a playback failure.
        try { report(sample); } catch {}
    };
    const elapsed = (name: "PLAYER_EPISODE_DATA" | "PLAYER_EPISODE_SWITCH") => {
        const value = now() - startedAt;
        if (value >= 0 && value <= 600_000) emit({ id, name, value, delivery, load });
    };
    return {
        dataReady(nextDelivery: "file" | "hls", prefetched: boolean) {
            if (cancelled || ready) return;
            delivery = nextDelivery;
            load = prefetched ? "prefetched" : "network";
            ready = true;
            elapsed("PLAYER_EPISODE_DATA");
        },
        firstFrame() {
            if (cancelled || !ready) return;
            elapsed("PLAYER_EPISODE_SWITCH");
            cancelled = true;
        },
        failData() {
            if (cancelled || ready) return;
            emit({ id, name: "PLAYER_EPISODE_ERROR", value: 1, delivery });
            cancelled = true;
        },
        cancel() { cancelled = true; },
    };
};

export type EpisodeSwitchMeasurement = ReturnType<typeof createEpisodeSwitchMeasurement>;

export const beginEpisodeSwitchMeasurement = (delivery: "file" | "hls") => {
    try {
        return performanceSamplingEnabled() && document.visibilityState === "visible"
            ? createEpisodeSwitchMeasurement(delivery, reportPerformanceSample)
            : undefined;
    } catch { return undefined; }
};
