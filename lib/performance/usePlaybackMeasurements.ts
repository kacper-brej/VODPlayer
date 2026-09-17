"use client";

import { useEffect, type RefObject } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { consumeWatchIntent, flushPerformanceSamples, performanceSamplingEnabled, reportPerformanceSample } from "./client";
import { createPlaybackMeasurements } from "./playbackMeasurements";

export const usePlaybackMeasurements = (
    playerRef: RefObject<MediaPlayerInstance | null>,
    identity: string,
    delivery: "file" | "hls",
    party: boolean,
) => {
    useEffect(() => {
        const player = playerRef.current;
        if (!player || party || !performanceSamplingEnabled()) return;
        const measurements = createPlaybackMeasurements((name, value) => {
            reportPerformanceSample({ id: crypto.randomUUID(), name, value, delivery });
        });
        let video: HTMLVideoElement | null = null;
        let frame: number | undefined;
        const cancelFrame = () => {
            if (frame !== undefined) video?.cancelVideoFrameCallback(frame);
            frame = undefined;
        };
        const start = () => measurements.requestPlay();
        const playing = () => {
            cancelFrame();
            video = player.el?.querySelector("video") ?? null;
            if (video?.requestVideoFrameCallback) {
                frame = video.requestVideoFrameCallback(() => { frame = undefined; measurements.firstFrame(); });
            } else measurements.firstFrame();
        };
        const waiting = () => { if (!player.paused && !player.state.seeking) measurements.waiting(); };
        const pause = () => { cancelFrame(); measurements.pause(); };
        const hidden = () => {
            measurements.visibility(document.visibilityState !== "hidden");
            if (document.visibilityState === "hidden") cancelFrame();
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
            error: () => { cancelFrame(); measurements.error(); },
        };
        measurements.visibility(document.visibilityState !== "hidden");
        measurements.requestPlay(consumeWatchIntent());
        for (const [event, handler] of Object.entries(handlers)) player.addEventListener(event, handler);
        document.addEventListener("visibilitychange", hidden);
        return () => {
            cancelFrame();
            measurements.dispose();
            flushPerformanceSamples();
            for (const [event, handler] of Object.entries(handlers)) player.removeEventListener(event, handler);
            document.removeEventListener("visibilitychange", hidden);
        };
    }, [playerRef, identity, delivery, party]);
};
