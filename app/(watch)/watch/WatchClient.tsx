"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import saveProgressAction from "@/lib/progress/saveProgressAction";
import PlayerErrorBoundary from "@/components/video/PlayerErrorBoundary";
import VideoPlayer, { preloadVideoPlayer } from "@/components/video/LazyVideoPlayer";
import { partyWatchPath, seriesPath, watchPath } from "@/lib/core/routes";
import type { WatchData } from "@/lib/player/watchData";
import { startPartyForEpisode } from "@/lib/party/startPartyForEpisode";
import type { VideoPlayerProps } from "@/components/video/VideoPlayer";
import { createNextEpisodePrefetch, watchDataUrl } from "@/lib/player/nextEpisodePrefetch";
import { beginEpisodeSwitchMeasurement, type EpisodeSwitchMeasurement } from "@/lib/performance/episodeSwitchMeasurements";

const PartyVideoPlayer = dynamic(() => import("@/components/video/PartyVideoPlayer"), {
    ssr: false,
    loading: () => (
        <div className="np-player-loading" role="status">
            <span className="np-player-loading-ring" />
            <span>Łączenie z pokojem</span>
        </div>
    ),
});

type WatchClientProps = WatchData;

const WatchClient = (initialData: WatchClientProps) => {
    const [data, setData] = useState(initialData);
    const [previousInitialData, setPreviousInitialData] = useState(initialData);
    if (initialData.seriesKey !== previousInitialData.seriesKey
        || initialData.fileName !== previousInitialData.fileName
        || initialData.playback.src !== previousInitialData.playback.src
        || initialData.startTime !== previousInitialData.startTime
        || initialData.partyCode !== previousInitialData.partyCode) {
        setPreviousInitialData(initialData);
        setData(initialData);
    }
    const {
        playback,
        seriesTitle,
        episodeTitle,
        seasonNumber,
        episodeSynopsis,
        seriesId,
        seriesKey,
        currentEpisode,
        totalEpisodes,
        fileName,
        startTime,
        nextEpisodeTitle,
        chapters,
        autoplayNext,
        skipIntroPrompt,
        defaultVolume,
        reduceData = false,
        isDemo = false,
        trackProgress = true,
        partyCode,
        episodeKeys,
        nextEpisodeKey,
        previousEpisodeKey,
    } = data;
    useEffect(() => {
        void preloadVideoPlayer(playback.kind === "hls").catch(() => undefined);
    }, [playback.kind]);

    const router = useRouter();
    const [playerInstanceKey, setPlayerInstanceKey] = useState(0);
    const [partyStartError, setPartyStartError] = useState<string | null>(null);
    const isNavigatingRef = useRef(false);
    const episodeRequestRef = useRef<AbortController | null>(null);
    const requestedEpisodeRef = useRef<string | null>(null);
    const [episodeLoading, setEpisodeLoading] = useState(false);
    const [episodeError, setEpisodeError] = useState<string | null>(null);
    const [nextPrefetch] = useState(createNextEpisodePrefetch);
    const switchMeasurementRef = useRef<EpisodeSwitchMeasurement | undefined>(undefined);
    const [episodeMeasurement, setEpisodeMeasurement] = useState<{ identity: string; measurement: EpisodeSwitchMeasurement }>();

    useEffect(() => {
        const hidden = () => {
            if (document.visibilityState === "hidden") switchMeasurementRef.current?.cancel();
        };
        document.addEventListener("visibilitychange", hidden);
        return () => {
            switchMeasurementRef.current?.cancel();
            document.removeEventListener("visibilitychange", hidden);
        };
    }, [initialData.seriesKey, initialData.fileName, initialData.playback.src, initialData.partyCode]);

    useEffect(() => {
        const clear = () => nextPrefetch.clear();
        const onVisibilityChange = () => { if (document.visibilityState !== "visible") clear(); };
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pagehide", clear);
        window.addEventListener("blur", clear);
        return () => {
            clear();
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pagehide", clear);
            window.removeEventListener("blur", clear);
        };
    }, [nextPrefetch, seriesKey, fileName, partyCode, reduceData, initialData]);

    const prepareNextEpisode = useCallback(() => {
        if (!partyCode && !isDemo && !reduceData && nextEpisodeKey && !isNavigatingRef.current) {
            void nextPrefetch.prepare(seriesId, nextEpisodeKey);
        }
    }, [partyCode, isDemo, reduceData, nextEpisodeKey, nextPrefetch, seriesId]);

    useEffect(() => () => {
        const request = episodeRequestRef.current;
        episodeRequestRef.current = null;
        request?.abort();
        isNavigatingRef.current = false;
    }, [initialData.seriesKey, initialData.fileName, initialData.playback.src, initialData.partyCode]);

    const changeEpisode = useCallback(async (episodeKey: string) => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;
        requestedEpisodeRef.current = episodeKey;
        const controller = new AbortController();
        episodeRequestRef.current = controller;
        switchMeasurementRef.current?.cancel();
        const measurement = !partyCode && !isDemo ? beginEpisodeSwitchMeasurement(playback.kind) : undefined;
        switchMeasurementRef.current = measurement;
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        setEpisodeLoading(true);
        setEpisodeError(null);
        try {
            let next = !partyCode && !reduceData ? await nextPrefetch.take(seriesId, episodeKey, controller.signal) : null;
            const prefetched = next !== null;
            if (controller.signal.aborted) throw new Error("episode-load-aborted");
            if (!next) {
                nextPrefetch.clear();
                const response = await fetch(watchDataUrl(seriesId, episodeKey), {
                    cache: "no-store",
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error("episode-load-failed");
                next = await response.json() as WatchData;
            }
            if (controller.signal.aborted) return;
            measurement?.dataReady(next.playback.kind, prefetched);
            setEpisodeMeasurement(measurement ? { identity: `${next.seriesKey}/${next.fileName}`, measurement } : undefined);
            setData({ ...next, partyCode, trackProgress });
            // Keep the player mounted and update the address without an RSC navigation.
            window.history.replaceState(null, "", partyCode
                ? partyWatchPath(next.seriesId, next.fileName, partyCode)
                : watchPath(next.seriesId, next.fileName));
        } catch {
            if (episodeRequestRef.current === controller) {
                measurement?.failData();
                setEpisodeError("Nie udało się wczytać odcinka. Spróbuj ponownie.");
            }
        } finally {
            window.clearTimeout(timeout);
            if (episodeRequestRef.current === controller) {
                episodeRequestRef.current = null;
                isNavigatingRef.current = false;
                setEpisodeLoading(false);
            }
        }
    }, [partyCode, seriesId, trackProgress, nextPrefetch, reduceData, isDemo, playback.kind]);

    useEffect(() => {
        isNavigatingRef.current = false;
    }, [fileName, partyCode]);

    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent) => {
            const isVidstackNoise = event.filename?.includes("vidstack") && (
                event.message?.includes("setAttribute") || event.message?.includes("$state[prop]")
            );
            if (isVidstackNoise) {
                event.preventDefault();
            }
        };
        window.addEventListener('error', handleGlobalError);
        return () => window.removeEventListener('error', handleGlobalError);
    }, []);

    const handleProgressUpdate = async (currentTime: number) => {
        if (!trackProgress) return;

        await saveProgressAction({
            seriesKey,
            episodeKey: fileName,
            positionSeconds: currentTime,
        });
    };

    const handleNextEpisode = () => {
        if (nextEpisodeKey) {
            void changeEpisode(nextEpisodeKey);
        } else {
            if (isNavigatingRef.current) return;
            isNavigatingRef.current = true;
            router.replace(seriesPath(seriesId));
        }
    }

    const handlePreviousEpisode = () => {
        if (previousEpisodeKey) void changeEpisode(previousEpisodeKey);
    }

    const handleBack = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        router.push("/");
    }

    const handleStartParty = async (positionSeconds: number) => {
        if (isNavigatingRef.current) return;
        const result = await startPartyForEpisode(seriesKey, fileName, positionSeconds);
        if (!result.ok || !result.code) {
            setPartyStartError(result.error ?? "Nie udało się utworzyć pokoju.");
            window.setTimeout(() => setPartyStartError(null), 4000);
            return;
        }
        isNavigatingRef.current = true;
        router.replace(partyWatchPath(seriesId, currentEpisode, result.code));
    }

    const playerProps: VideoPlayerProps = {
        playback,
        episodeSwitchMeasurement: episodeMeasurement?.identity === `${seriesKey}/${fileName}` ? episodeMeasurement.measurement : undefined,
        seriesKey,
        episodeKey: fileName,
        title: seriesTitle,
        kicker: `Odcinek ${currentEpisode}`,
        subtitle: episodeTitle,
        seasonNumber,
        episodeNumber: currentEpisode,
        episodeSynopsis,
        episodesLeft: Math.max(0, totalEpisodes - currentEpisode),
        nextEpisodeTitle,
        onBack: handleBack,
        onNextEpisode: handleNextEpisode,
        onPrefetchNextEpisode: nextEpisodeKey && !partyCode && !isDemo && !reduceData ? prepareNextEpisode : undefined,
        onPreviousEpisode: previousEpisodeKey ? handlePreviousEpisode : undefined,
        onProgressUpdate: handleProgressUpdate,
        startTime,
        chapters,
        autoplayNext,
        skipIntroPrompt,
        defaultVolume,
        onStartParty: partyCode ? undefined : (positionSeconds: number) => void handleStartParty(positionSeconds),
    };

    return (
        <div className="np-watch-screen">
            <h1 className="sr-only">
                {seriesTitle} — {episodeTitle}
                {isDemo ? " (materiał demonstracyjny)" : ""}
            </h1>

            {partyStartError && (
                <p
                    role="alert"
                    className="np-watch-toast np-watch-toast--error"
                >
                    {partyStartError}
                </p>
            )}

            {(episodeLoading || episodeError) && (
                <div role={episodeError ? "alert" : "status"} className="np-watch-toast">
                    {episodeError ?? "Ładowanie odcinka…"}
                    {episodeError && (
                        <button type="button" className="np-error-secondary" onClick={() => {
                            if (requestedEpisodeRef.current) void changeEpisode(requestedEpisodeRef.current);
                        }}>
                            Spróbuj ponownie
                        </button>
                    )}
                </div>
            )}

            {isDemo && (
                <aside
                    aria-label="Autor i licencja materiału demonstracyjnego"
                    className="np-watch-toast np-watch-toast--demo"
                >
                    <span>Sprite Fright</span>
                    <span aria-hidden="true">·</span>
                    <a
                        href="https://studio.blender.org/projects/sprite-fright/pages/about/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="np-watch-demo-attribution-link"
                    >
                        (CC) Blender Foundation
                    </a>
                    <span aria-hidden="true">·</span>
                    <a
                        href="https://creativecommons.org/licenses/by/1.0/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="np-watch-demo-attribution-link"
                    >
                        CC BY 1.0
                    </a>
                </aside>
            )}

            <div className="np-watch-player-slot">
                <PlayerErrorBoundary
                    key={playerInstanceKey}
                    onRetry={() => setPlayerInstanceKey((k) => k + 1)}
                    onBack={handleBack}
                >
                    {partyCode ? (
                        <PartyVideoPlayer
                            code={partyCode}
                            playerProps={playerProps}
                            seriesId={seriesId}
                            episodeKeys={episodeKeys}
                            nextEpisodeKey={nextEpisodeKey}
                            previousEpisodeKey={previousEpisodeKey}
                            onEpisodeChange={changeEpisode}
                        />
                    ) : <VideoPlayer {...playerProps} />}
                </PlayerErrorBoundary>
            </div>

        </div>
    )
}

export default WatchClient;
