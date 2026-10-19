"use client";

import { useEffect, type RefObject } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { consumeWatchIntent, flushPerformanceSamples, performanceSamplingEnabled, reportPerformanceSample } from "./client";
import { createPlaybackMeasurements } from "./playbackMeasurements";
import type { EpisodeSwitchMeasurement } from "./episodeSwitchMeasurements";

export const usePlaybackMeasurements = (
    playerRef: RefObject<MediaPlayerInstance | null>,
    identity: string,
    delivery: "file" | "hls",
    party: boolean,
    episodeSwitch?: EpisodeSwitchMeasurement,
) => {
    useEffect(() => {
        const player = playerRef.current;
        if (!player || party || !performanceSamplingEnabled()) return;
        const measurements = createPlaybackMeasurements((name, value) => {
            // Episode switches include the API wait; keep them out of initial-start percentiles.
            if (episodeSwitch && name === "PLAYER_STARTUP") return;
            reportPerformanceSample({ id: crypto.randomUUID(), name, value, delivery });
        });
        let video: HTMLVideoElement | null = null;
        let frame: number | undefined;
        const cancelFrame = () => {
            if (frame !== undefined) video?.cancelVideoFrameCallback(frame);
            frame = undefined;
        };
        const start = () => measurements.requestPlay();
        const firstFrame = () => { measurements.firstFrame(); episodeSwitch?.firstFrame(); };
        const playing = () => {
            cancelFrame();
            video = player.el?.querySelector("video") ?? null;
            if (video?.requestVideoFrameCallback) {
                frame = video.requestVideoFrameCallback(() => { frame = undefined; firstFrame(); });
            } else firstFrame();
        };
        const waiting = () => { if (!player.paused && !player.state.seeking) measurements.waiting(); };
        const pause = () => { cancelFrame(); measurements.pause(); episodeSwitch?.cancel(); };
        const hidden = () => {
            measurements.visibility(document.visibilityState !== "hidden");
            if (document.visibilityState === "hidden") { cancelFrame(); episodeSwitch?.cancel(); }
            else if (!player.paused) playing();
        };
        const handlers: Record<string, EventListener> = {
            "media-play-request": start,
            play: start,
            playing,
            waiting,
            stalled: waiting,
            seeking: () => { cancelFrame(); measurements.seeking(); },
            seeked: () => measurements.seeked(),
            pause,
            ended: pause,
            "auto-play-fail": pause,
            error: () => { cancelFrame(); measurements.error(); episodeSwitch?.cancel(); },
        };
        measurements.visibility(document.visibilityState !== "hidden");
        measurements.requestPlay(consumeWatchIntent());
        for (const [event, handler] of Object.entries(handlers)) player.addEventListener(event, handler);
        document.addEventListener("visibilitychange", hidden);
        return () => {
            cancelFrame();
            episodeSwitch?.cancel();
            measurements.dispose();
            flushPerformanceSamples();
            for (const [event, handler] of Object.entries(handlers)) player.removeEventListener(event, handler);
            document.removeEventListener("visibilitychange", hidden);
        };
    }, [playerRef, identity, delivery, party, episodeSwitch]);
};
